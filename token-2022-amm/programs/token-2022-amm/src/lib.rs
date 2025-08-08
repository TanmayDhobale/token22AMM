use anchor_lang::prelude::*;
use anchor_spl::token_2022::{
    spl_token_2022::instruction as token_instruction,
    Token2022, TokenAccount, Mint, TransferChecked, transfer_checked,
};
use spl_transfer_hook_interface::onchain::invoke_transfer_checked;
use spl_tlv_account_resolution::account::ExtraAccountMeta;
use spl_token_2022::state::{Mint as SplMint, StateWithExtensions};
use spl_token_2022::extension::transfer_hook::TransferHook as TransferHookExt;

declare_id!("BUSnE2ekGTqthHsRd2X1HdkWKa4o4AkzjwhD2yDToUXs");

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
        amm.bump = *ctx.bumps.get("amm").unwrap();
        
        msg!("AMM initialized successfully");
        Ok(())
    }

    /// Create a new liquidity pool
    pub fn create_pool(
        ctx: Context<CreatePool>,
        initial_token_a_amount: u64,
        initial_token_b_amount: u64,
    ) -> Result<()> {
        // Transfer initial liquidity to vaults
        let transfer_a_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_token_a.to_account_info(),
                mint: ctx.accounts.token_a_mint.to_account_info(),
                to: ctx.accounts.token_a_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        transfer_checked(transfer_a_ctx, initial_token_a_amount, ctx.accounts.token_a_mint.decimals)?;

        let transfer_b_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_token_b.to_account_info(),
                mint: ctx.accounts.token_b_mint.to_account_info(),
                to: ctx.accounts.token_b_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        transfer_checked(transfer_b_ctx, initial_token_b_amount, ctx.accounts.token_b_mint.decimals)?;

        // Mint LP tokens to user
        let pool = &mut ctx.accounts.pool;
        pool.token_a_amount = initial_token_a_amount;
        pool.token_b_amount = initial_token_b_amount;
        pool.lp_supply = initial_token_a_amount; // Simplified LP calculation

        msg!("Pool created with {} token A and {} token B", initial_token_a_amount, initial_token_b_amount);
        Ok(())
    }

    /// Swap tokens with transfer hook support
    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        // Enforce hook whitelist when mints have a transfer hook extension
        // Input mint
        if let Some(hook_pid) = extract_transfer_hook_program_id(&ctx.accounts.token_in_mint)? {
            require!(
                ctx.accounts.whitelist.allowed.iter().any(|p| p == &hook_pid),
                AmmError::HookNotWhitelisted
            );
        }
        // Output mint
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

        // Transfer tokens from user to vault
        let transfer_in_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_token_in.to_account_info(),
                mint: ctx.accounts.token_in_mint.to_account_info(),
                to: ctx.accounts.token_in_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );

        // Prefer transfer hook path when extra accounts are provided via remaining_accounts
        if !ctx.remaining_accounts.is_empty() {
            invoke_transfer_checked(
                ctx.accounts.token_program.key(),
                ctx.accounts.user_token_in.to_account_info(),
                ctx.accounts.token_in_mint.to_account_info(),
                ctx.accounts.token_in_vault.to_account_info(),
                ctx.accounts.user.to_account_info(),
                &ctx.remaining_accounts,
                amount_in,
                ctx.accounts.token_in_mint.decimals,
                &[],
            )?;
        } else {
            transfer_checked(transfer_in_ctx, amount_in, ctx.accounts.token_in_mint.decimals)?;
        }

        // Transfer tokens from vault to user
        let transfer_out_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.token_out_vault.to_account_info(),
                mint: ctx.accounts.token_out_mint.to_account_info(),
                to: ctx.accounts.user_token_out.to_account_info(),
                authority: ctx.accounts.amm.to_account_info(),
            },
        );

        // Prefer transfer hook path when remaining accounts provided
        if !ctx.remaining_accounts.is_empty() {
            invoke_transfer_checked(
                ctx.accounts.token_program.key(),
                ctx.accounts.token_out_vault.to_account_info(),
                ctx.accounts.token_out_mint.to_account_info(),
                ctx.accounts.user_token_out.to_account_info(),
                ctx.accounts.amm.to_account_info(),
                &ctx.remaining_accounts,
                amount_out,
                ctx.accounts.token_out_mint.decimals,
                &[],
            )?;
        } else {
            transfer_checked(transfer_out_ctx, amount_out, ctx.accounts.token_out_mint.decimals)?;
        }

        // Update pool balances
        pool.token_a_amount = pool.token_a_amount.checked_add(amount_in).unwrap();
        pool.token_b_amount = pool.token_b_amount.checked_sub(amount_out).unwrap();

        msg!("Swap completed: {} in, {} out", amount_in, amount_out);
        Ok(())
    }

    /// Add liquidity to the pool
    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        token_a_amount: u64,
        token_b_amount: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;

        // Transfer tokens to vaults
        let transfer_a_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_token_a.to_account_info(),
                mint: ctx.accounts.token_a_mint.to_account_info(),
                to: ctx.accounts.token_a_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        transfer_checked(transfer_a_ctx, token_a_amount, ctx.accounts.token_a_mint.decimals)?;

        let transfer_b_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_token_b.to_account_info(),
                mint: ctx.accounts.token_b_mint.to_account_info(),
                to: ctx.accounts.token_b_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        transfer_checked(transfer_b_ctx, token_b_amount, ctx.accounts.token_b_mint.decimals)?;

        // Calculate LP tokens to mint
        let lp_tokens_to_mint = calculate_lp_tokens(token_a_amount, token_b_amount, pool)?;

        // Mint LP tokens to user
        let mint_lp_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token::MintTo {
                mint: ctx.accounts.lp_mint.to_account_info(),
                to: ctx.accounts.user_lp_token.to_account_info(),
                authority: ctx.accounts.amm.to_account_info(),
            },
        );
        anchor_spl::token::mint_to(mint_lp_ctx, lp_tokens_to_mint)?;

        // Update pool balances
        pool.token_a_amount = pool.token_a_amount.checked_add(token_a_amount).unwrap();
        pool.token_b_amount = pool.token_b_amount.checked_add(token_b_amount).unwrap();
        pool.lp_supply = pool.lp_supply.checked_add(lp_tokens_to_mint).unwrap();

        msg!("Liquidity added: {} LP tokens minted", lp_tokens_to_mint);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeAmm<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Amm::INIT_SPACE,
        seeds = [b"amm"],
        bump
    )]
    pub amm: Account<'info, Amm>,
    
    pub token_a_mint: Account<'info, Mint>,
    pub token_b_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        associated_token::mint = token_a_mint,
        associated_token::authority = amm,
    )]
    pub token_a_vault: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = authority,
        associated_token::mint = token_b_mint,
        associated_token::authority = amm,
    )]
    pub token_b_vault: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = amm,
    )]
    pub lp_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    pub amm: Account<'info, Amm>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub user_token_a: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_b: Account<'info, TokenAccount>,
    
    pub token_a_mint: Account<'info, Mint>,
    pub token_b_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub token_a_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub token_b_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    pub amm: Account<'info, Amm>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub user_token_in: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_out: Account<'info, TokenAccount>,
    
    pub token_in_mint: Account<'info, Mint>,
    pub token_out_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub token_in_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub token_out_vault: Account<'info, TokenAccount>,
    /// Whitelist for allowed transfer-hook program IDs
    #[account(
        seeds = [b"whitelist", amm.key().as_ref()],
        bump,
        constraint = whitelist.amm == amm.key() @ AmmError::InvalidWhitelist
    )]
    pub whitelist: Account<'info, HookWhitelist>,
    
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    pub amm: Account<'info, Amm>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub user_token_a: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_b: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_lp_token: Account<'info, TokenAccount>,
    
    pub token_a_mint: Account<'info, Mint>,
    pub token_b_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub token_a_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub token_b_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub lp_mint: Account<'info, Mint>,
    
    pub token_program: Program<'info, Token2022>,
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
    #[msg("Invalid liquidity calculation")]
    InvalidLiquidityCalculation,
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

fn calculate_lp_tokens(
    token_a_amount: u64,
    token_b_amount: u64,
    pool: &Account<Pool>,
) -> Result<u64> {
    if pool.lp_supply == 0 {
        // First liquidity provider
        Ok(token_a_amount)
    } else {
        // Calculate proportional LP tokens
        let lp_tokens_a = token_a_amount
            .checked_mul(pool.lp_supply)
            .unwrap()
            .checked_div(pool.token_a_amount)
            .unwrap();
        let lp_tokens_b = token_b_amount
            .checked_mul(pool.lp_supply)
            .unwrap()
            .checked_div(pool.token_b_amount)
            .unwrap();
        
        Ok(lp_tokens_a.min(lp_tokens_b))
    }
}

// -------------------------------
// Hook whitelist account & ixes
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
        space = 8 + 32 + 4 + (32 * 16), // allow up to 16 allowed programs initially
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

impl<'info> From<&UpdateWhitelist<'info>> for Account<'info, HookWhitelist> {
    fn from(accs: &UpdateWhitelist<'info>) -> Self {
        accs.whitelist.clone()
    }
}

#[program]
pub mod whitelist_controls {
    use super::*;

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

// -------------------------------
// Helpers
// -------------------------------

fn extract_transfer_hook_program_id(mint: &Account<Mint>) -> Result<Option<Pubkey>> {
    let data = mint.to_account_info().data.borrow();
    let with_ext = StateWithExtensions::<SplMint>::unpack(&data)
        .map_err(|_| error!(AmmError::InvalidSwapCalculation))?;
    if let Ok(ext) = with_ext.get_extension::<TransferHookExt>() {
        Ok(Some(ext.program_id))
    } else {
        Ok(None)
    }
}
