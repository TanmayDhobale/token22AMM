// Complete Token-2022 AMM Program for Solana Playground
// This program supports transfer hooks and Token-2022 extensions

use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface};
use anchor_lang::solana_program::{program::{invoke, invoke_signed}, account_info::AccountInfo};
use spl_token_2022::state::Mint as SplMint;
use spl_token_2022::extension::{BaseStateWithExtensions, StateWithExtensions, transfer_hook::TransferHook as TransferHookExt};

declare_id!("7FCFLQ6L9bvrd1YprvgQvRoCRZ2J5oMoUSL35SX55aZC");

#[program]
pub mod token_2022_amm {
    use super::*;

    /// Initialize the AMM
    pub fn initialize_amm(
        ctx: Context<InitializeAmm>,
        pool_fee: u64,
        pool_fee_denominator: u64,
    ) -> Result<()> {
        let amm = &mut ctx.accounts.amm;
        amm.authority = ctx.accounts.authority.key();
        amm.pool_fee = pool_fee;
        amm.pool_fee_denominator = pool_fee_denominator;
        amm.token_a_mint = ctx.accounts.token_a_mint.key();
        amm.token_b_mint = ctx.accounts.token_b_mint.key();
        amm.token_a_vault = ctx.accounts.token_a_vault.key();
        amm.token_b_vault = ctx.accounts.token_b_vault.key();
        amm.lp_mint = ctx.accounts.lp_mint.key();
        amm.bump = ctx.bumps.amm;
        
        msg!("AMM initialized successfully");
        Ok(())
    }

    /// Create a new liquidity pool
    pub fn create_pool(
        ctx: Context<CreatePool>,
        initial_token_a_amount: u64,
        initial_token_b_amount: u64,
    ) -> Result<()> {
        // Transfer initial liquidity to vaults using Token-2022
        let transfer_a_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token_interface::TransferChecked {
                from: ctx.accounts.user_token_a.to_account_info(),
                mint: ctx.accounts.token_a_mint.to_account_info(),
                to: ctx.accounts.token_a_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        anchor_spl::token_interface::transfer_checked(transfer_a_ctx, initial_token_a_amount, ctx.accounts.token_a_mint.decimals)?;

        let transfer_b_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token_interface::TransferChecked {
                from: ctx.accounts.user_token_b.to_account_info(),
                mint: ctx.accounts.token_b_mint.to_account_info(),
                to: ctx.accounts.token_b_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        anchor_spl::token_interface::transfer_checked(transfer_b_ctx, initial_token_b_amount, ctx.accounts.token_b_mint.decimals)?;

        // Initialize pool state
        let pool = &mut ctx.accounts.pool;
        pool.token_a_amount = initial_token_a_amount;
        pool.token_b_amount = initial_token_b_amount;
        pool.lp_supply = initial_token_a_amount; // Simplified LP calculation

        msg!("Pool created with {} token A and {} token B", initial_token_a_amount, initial_token_b_amount);
        Ok(())
    }

    /// Swap tokens
    pub fn swap<'info>(
        ctx: Context<'_, '_, '_, 'info, Swap<'info>>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        // 1) Enforce whitelist for any transfer-hook mints
        if let Some(hook_pid) = extract_transfer_hook_program_id(&ctx.accounts.token_in_mint)? {
            require!(
                ctx.accounts.whitelist.allowed.iter().any(|p| p == &hook_pid),
                AmmError::HookNotWhitelisted
            );
        }
        if let Some(hook_pid) = extract_transfer_hook_program_id(&ctx.accounts.token_out_mint)? {
            require!(
                ctx.accounts.whitelist.allowed.iter().any(|p| p == &hook_pid),
                AmmError::HookNotWhitelisted
            );
        }
        
        // Calculate swap amounts (constant product formula)
        let amount_out = calculate_swap_output(
            amount_in,
            pool.token_a_amount,
            pool.token_b_amount,
            ctx.accounts.amm.pool_fee,
            ctx.accounts.amm.pool_fee_denominator,
        )?;

        require!(
            amount_out >= minimum_amount_out,
            AmmError::InsufficientOutputAmount
        );

        // 2) Transfer user -> vault; prefer hook path if remaining accounts provided
        if !ctx.remaining_accounts.is_empty() {
            // Manual CPI with remaining accounts to trigger hook
            let ix_in = spl_token_2022::instruction::transfer_checked(
                &ctx.accounts.token_program.key(),
                &ctx.accounts.user_token_in.key(),
                &ctx.accounts.token_in_mint.key(),
                &ctx.accounts.token_in_vault.key(),
                &ctx.accounts.user.key(),
                &[],
                amount_in,
                ctx.accounts.token_in_mint.decimals,
            ).map_err(|_| error!(AmmError::InvalidSwapCalculation))?;

            let mut infos_in: Vec<AccountInfo<'_>> = Vec::with_capacity(4 + ctx.remaining_accounts.len());
            let a0 = ctx.accounts.user_token_in.to_account_info();
            let a1 = ctx.accounts.token_in_mint.to_account_info();
            let a2 = ctx.accounts.token_in_vault.to_account_info();
            let a3 = ctx.accounts.user.to_account_info();
            infos_in.push(a0);
            infos_in.push(a1);
            infos_in.push(a2);
            infos_in.push(a3);
            for ai in ctx.remaining_accounts.iter() { infos_in.push(ai.clone()); }
            invoke(&ix_in, &infos_in).map_err(|_| error!(AmmError::InvalidSwapCalculation))?;
        } else {
            let transfer_in_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: ctx.accounts.user_token_in.to_account_info(),
                    mint: ctx.accounts.token_in_mint.to_account_info(),
                    to: ctx.accounts.token_in_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            );
            token_interface::transfer_checked(transfer_in_ctx, amount_in, ctx.accounts.token_in_mint.decimals)?;
        }

        // Transfer tokens from vault to user (using AMM authority)
        let amm_seeds = &[
            b"amm",
            ctx.accounts.amm.token_a_mint.as_ref(),
            ctx.accounts.amm.token_b_mint.as_ref(),
            &[ctx.accounts.amm.bump],
        ];
        let signer = &[&amm_seeds[..]];

        // 3) Transfer vault -> user; prefer hook path when provided
        if !ctx.remaining_accounts.is_empty() {
            let ix_out = spl_token_2022::instruction::transfer_checked(
                &ctx.accounts.token_program.key(),
                &ctx.accounts.token_out_vault.key(),
                &ctx.accounts.token_out_mint.key(),
                &ctx.accounts.user_token_out.key(),
                &ctx.accounts.amm.key(),
                &[],
                amount_out,
                ctx.accounts.token_out_mint.decimals,
            ).map_err(|_| error!(AmmError::InvalidSwapCalculation))?;

            let mut infos_out: Vec<AccountInfo<'_>> = Vec::with_capacity(4 + ctx.remaining_accounts.len());
            let b0 = ctx.accounts.token_out_vault.to_account_info();
            let b1 = ctx.accounts.token_out_mint.to_account_info();
            let b2 = ctx.accounts.user_token_out.to_account_info();
            let b3 = ctx.accounts.amm.to_account_info();
            infos_out.push(b0);
            infos_out.push(b1);
            infos_out.push(b2);
            infos_out.push(b3);
            for ai in ctx.remaining_accounts.iter() { infos_out.push(ai.clone()); }
            invoke_signed(&ix_out, &infos_out, signer)
                .map_err(|_| error!(AmmError::InvalidSwapCalculation))?;
        } else {
            let transfer_out_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token_interface::TransferChecked {
                    from: ctx.accounts.token_out_vault.to_account_info(),
                    mint: ctx.accounts.token_out_mint.to_account_info(),
                    to: ctx.accounts.user_token_out.to_account_info(),
                    authority: ctx.accounts.amm.to_account_info(),
                },
                signer,
            );
            token_interface::transfer_checked(transfer_out_ctx, amount_out, ctx.accounts.token_out_mint.decimals)?;
        }

        // Update pool balances
        pool.token_a_amount = pool.token_a_amount.checked_add(amount_in).unwrap();
        pool.token_b_amount = pool.token_b_amount.checked_sub(amount_out).unwrap();

        msg!("Swap completed: {} in, {} out", amount_in, amount_out);
        Ok(())
    }

    // -------------------------------
    // Whitelist controls (merged here)
    // -------------------------------
    pub fn initialize_whitelist(ctx: Context<InitializeWhitelist>) -> Result<()> {
        let wl = &mut ctx.accounts.whitelist;
        wl.amm = ctx.accounts.amm.key();
        wl.allowed = Vec::new();
        Ok(())
    }

    pub fn add_hook_program(ctx: Context<UpdateWhitelist>, program_id: Pubkey) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.amm.authority,
            ctx.accounts.authority.key(),
            AmmError::InvalidWhitelist
        );
        let wl = &mut ctx.accounts.whitelist;
        if !wl.allowed.iter().any(|p| p == &program_id) {
            wl.allowed.push(program_id);
        }
        Ok(())
    }

    pub fn remove_hook_program(ctx: Context<UpdateWhitelist>, program_id: Pubkey) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.amm.authority,
            ctx.accounts.authority.key(),
            AmmError::InvalidWhitelist
        );
        let wl = &mut ctx.accounts.whitelist;
        wl.allowed.retain(|p| p != &program_id);
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(pool_fee: u64, pool_fee_denominator: u64)]
pub struct InitializeAmm<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Amm::INIT_SPACE,
        seeds = [b"amm", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub amm: Account<'info, Amm>,
    
    pub token_a_mint: InterfaceAccount<'info, Mint>,
    pub token_b_mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        seeds = [b"token_a_vault", amm.key().as_ref()],
        bump,
        token::mint = token_a_mint,
        token::authority = amm,
        token::token_program = token_program
    )]
    pub token_a_vault: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        init,
        payer = authority,
        seeds = [b"token_b_vault", amm.key().as_ref()],
        bump,
        token::mint = token_b_mint,
        token::authority = amm,
        token::token_program = token_program
    )]
    pub token_b_vault: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        init,
        payer = authority,
        seeds = [b"lp_mint", amm.key().as_ref()],
        bump,
        mint::decimals = 6,
        mint::authority = amm,
        mint::token_program = token_program
    )]
    pub lp_mint: InterfaceAccount<'info, Mint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Pool::INIT_SPACE,
        seeds = [b"pool", amm.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,
    
    #[account(
        seeds = [b"amm", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump = amm.bump
    )]
    pub amm: Account<'info, Amm>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub user_token_a: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_b: InterfaceAccount<'info, TokenAccount>,
    
    pub token_a_mint: InterfaceAccount<'info, Mint>,
    pub token_b_mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        mut,
        seeds = [b"token_a_vault", amm.key().as_ref()],
        bump
    )]
    pub token_a_vault: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"token_b_vault", amm.key().as_ref()],
        bump
    )]
    pub token_b_vault: InterfaceAccount<'info, TokenAccount>,
    
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(
        mut,
        seeds = [b"pool", amm.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,
    
    #[account(
        seeds = [b"amm", token_in_mint.key().as_ref(), token_out_mint.key().as_ref()],
        bump = amm.bump
    )]
    pub amm: Account<'info, Amm>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub user_token_in: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_out: InterfaceAccount<'info, TokenAccount>,
    
    pub token_in_mint: InterfaceAccount<'info, Mint>,
    pub token_out_mint: InterfaceAccount<'info, Mint>,
    
    #[account(
        mut,
        seeds = [b"token_a_vault", amm.key().as_ref()],
        bump
    )]
    pub token_in_vault: InterfaceAccount<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [b"token_b_vault", amm.key().as_ref()],
        bump
    )]
    pub token_out_vault: InterfaceAccount<'info, TokenAccount>,

    /// Whitelist PDA for allowed transfer-hook program IDs
    #[account(
        seeds = [b"whitelist", amm.key().as_ref()],
        bump,
        constraint = whitelist.amm == amm.key() @ AmmError::InvalidWhitelist
    )]
    pub whitelist: Account<'info, HookWhitelist>,
    
    pub token_program: Interface<'info, TokenInterface>,
}

#[account]
#[derive(InitSpace)]
pub struct Amm {
    pub authority: Pubkey,
    pub pool_fee: u64,
    pub pool_fee_denominator: u64,
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub token_a_vault: Pubkey,
    pub token_b_vault: Pubkey,
    pub lp_mint: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub token_a_amount: u64,
    pub token_b_amount: u64,
    pub lp_supply: u64,
}

#[error_code]
pub enum AmmError {
    #[msg("Insufficient output amount")]
    InsufficientOutputAmount,
    #[msg("Invalid swap calculation")]
    InvalidSwapCalculation,
    #[msg("Transfer-hook program is not whitelisted")]
    HookNotWhitelisted,
    #[msg("Invalid whitelist account")]
    InvalidWhitelist,
}

fn calculate_swap_output(
    amount_in: u64,
    reserve_in: u64,
    reserve_out: u64,
    fee: u64,
    fee_denominator: u64,
) -> Result<u64> {
    let amount_in_with_fee = amount_in
        .checked_mul(fee_denominator.checked_sub(fee).unwrap())
        .unwrap();
    let numerator = amount_in_with_fee.checked_mul(reserve_out).unwrap();
    let denominator = reserve_in
        .checked_mul(fee_denominator)
        .unwrap()
        .checked_add(amount_in_with_fee)
        .unwrap();
    
    let amount_out = numerator.checked_div(denominator).unwrap();
    Ok(amount_out)
}

// Test functions for Solana Playground
#[cfg(test)]
mod tests {
    use super::*;
    use anchor_lang::prelude::*;

    #[test]
    fn test_swap_calculation() {
        let amount_in = 1000000; // 1 token
        let reserve_in = 1000000000; // 1000 tokens
        let reserve_out = 500000000; // 500 tokens
        let fee = 25; // 0.25%
        let fee_denominator = 10000;

        let result = calculate_swap_output(amount_in, reserve_in, reserve_out, fee, fee_denominator);
        assert!(result.is_ok());
        
        let amount_out = result.unwrap();
        println!("Swap output: {}", amount_out);
        assert!(amount_out > 0);
    }
}

// -------------------------------
// Whitelist + helpers
// -------------------------------

#[account]
pub struct HookWhitelist {
    pub amm: Pubkey,
    pub allowed: Vec<Pubkey>,
}

#[derive(Accounts)]
pub struct InitializeWhitelist<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub amm: Account<'info, Amm>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 4 + (32 * 16),
        seeds = [b"whitelist", amm.key().as_ref()],
        bump
    )]
    pub whitelist: Account<'info, HookWhitelist>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateWhitelist<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub amm: Account<'info, Amm>,
    #[account(
        mut,
        seeds = [b"whitelist", amm.key().as_ref()],
        bump,
        constraint = whitelist.amm == amm.key() @ AmmError::InvalidWhitelist
    )]
    pub whitelist: Account<'info, HookWhitelist>,
}

// (whitelist_controls module removed; merged into main program above)

fn extract_transfer_hook_program_id(mint: &InterfaceAccount<Mint>) -> Result<Option<Pubkey>> {
    let mint_ai = mint.to_account_info();
    let data = mint_ai.data.borrow();
    let with_ext = StateWithExtensions::<SplMint>::unpack(&data)
        .map_err(|_| error!(AmmError::InvalidSwapCalculation))?;
    if let Ok(ext) = with_ext.get_extension::<TransferHookExt>() {
        if let Some(program_id) = Option::<Pubkey>::from(ext.program_id) {
            Ok(Some(program_id))
        } else {
            Ok(None)
        }
    } else {
        Ok(None)
    }
}
