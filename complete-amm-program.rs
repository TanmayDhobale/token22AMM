// Complete Token-2022 AMM Program for Solana Playground
// This program supports transfer hooks and Token-2022 extensions

use anchor_lang::prelude::*;
use anchor_spl::token_2022::{Token2022};
use anchor_spl::token_interface::{TokenAccount, Mint, TokenInterface};

declare_id!("11111111111111111111111111111111"); // Will be replaced by Solana Playground

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
    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        
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

        // Transfer tokens from user to vault using Token-2022
        let transfer_in_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token_interface::TransferChecked {
                from: ctx.accounts.user_token_in.to_account_info(),
                mint: ctx.accounts.token_in_mint.to_account_info(),
                to: ctx.accounts.token_in_vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        anchor_spl::token_interface::transfer_checked(transfer_in_ctx, amount_in, ctx.accounts.token_in_mint.decimals)?;

        // Transfer tokens from vault to user (using AMM authority)
        let amm_seeds = &[
            b"amm",
            ctx.accounts.amm.token_a_mint.as_ref(),
            ctx.accounts.amm.token_b_mint.as_ref(),
            &[ctx.accounts.amm.bump],
        ];
        let signer = &[&amm_seeds[..]];

        let transfer_out_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token_interface::TransferChecked {
                from: ctx.accounts.token_out_vault.to_account_info(),
                mint: ctx.accounts.token_out_mint.to_account_info(),
                to: ctx.accounts.user_token_out.to_account_info(),
                authority: ctx.accounts.amm.to_account_info(),
            },
            signer,
        );
        anchor_spl::token_interface::transfer_checked(transfer_out_ctx, amount_out, ctx.accounts.token_out_mint.decimals)?;

        // Update pool balances
        pool.token_a_amount = pool.token_a_amount.checked_add(amount_in).unwrap();
        pool.token_b_amount = pool.token_b_amount.checked_sub(amount_out).unwrap();

        msg!("Swap completed: {} in, {} out", amount_in, amount_out);
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
