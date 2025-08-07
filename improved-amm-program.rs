use anchor_lang::prelude::*;

declare_id!("GDDeowRpYTB4vB2G2fb2axbxTLuX69dDi23YuPoLA3gh");

#[program]
pub mod improved_amm {
    use super::*;

    /// Initialize AMM state
    pub fn initialize_amm(
        ctx: Context<InitializeAmm>,
        pool_fee: u64,
        pool_fee_denominator: u64,
    ) -> Result<()> {
        let amm = &mut ctx.accounts.amm;
        amm.authority = ctx.accounts.user.key();
        amm.pool_fee = pool_fee;
        amm.pool_fee_denominator = pool_fee_denominator;
        amm.token_a_mint = ctx.accounts.token_a_mint.key();
        amm.token_b_mint = ctx.accounts.token_b_mint.key();
        amm.bump = ctx.bumps.amm;

        msg!("AMM initialized with {}% fee", pool_fee as f64 / pool_fee_denominator as f64 * 100.0);
        Ok(())
    }

    /// Create a new pool
    pub fn create_pool(
        ctx: Context<CreatePool>,
        initial_token_a_amount: u64,
        initial_token_b_amount: u64,
    ) -> Result<()> {
        require!(initial_token_a_amount > 0, AmmError::InvalidAmount);
        require!(initial_token_b_amount > 0, AmmError::InvalidAmount);
        
        // Initialize pool state
        let pool = &mut ctx.accounts.pool;
        pool.token_a_amount = initial_token_a_amount;
        pool.token_b_amount = initial_token_b_amount;
        pool.lp_supply = initial_token_a_amount; // Simplified LP calculation

        msg!("Pool created with {} token A and {} token B", initial_token_a_amount, initial_token_b_amount);
        Ok(())
    }

    /// Swap tokens with better error handling
    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        
        require!(amount_in > 0, AmmError::InvalidAmount);
        require!(pool.token_a_amount > 0, AmmError::InsufficientLiquidity);
        require!(pool.token_b_amount > 0, AmmError::InsufficientLiquidity);
        
        msg!("Starting swap: amount_in={}, pool_a={}, pool_b={}", 
             amount_in, pool.token_a_amount, pool.token_b_amount);
        
        // Calculate swap amounts (constant product formula) with safe math
        let amount_out = calculate_swap_output_safe(
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

        require!(
            amount_out < pool.token_b_amount,
            AmmError::InsufficientLiquidity
        );

        // Update pool balances with safe math
        pool.token_a_amount = pool.token_a_amount
            .checked_add(amount_in)
            .ok_or(AmmError::MathOverflow)?;
            
        pool.token_b_amount = pool.token_b_amount
            .checked_sub(amount_out)
            .ok_or(AmmError::MathOverflow)?;

        msg!("Swap completed: {} in, {} out, new reserves: {}, {}", 
             amount_in, amount_out, pool.token_a_amount, pool.token_b_amount);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeAmm<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Amm::INIT_SPACE,
        seeds = [b"amm", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub amm: Account<'info, Amm>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: We're just referencing the mint
    pub token_a_mint: AccountInfo<'info>,
    /// CHECK: We're just referencing the mint
    pub token_b_mint: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
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
    
    /// CHECK: We're just referencing the mint
    pub token_a_mint: AccountInfo<'info>,
    /// CHECK: We're just referencing the mint
    pub token_b_mint: AccountInfo<'info>,
    
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
        seeds = [b"amm", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump = amm.bump
    )]
    pub amm: Account<'info, Amm>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: We're just referencing the mint
    pub token_a_mint: AccountInfo<'info>,
    /// CHECK: We're just referencing the mint
    pub token_b_mint: AccountInfo<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Amm {
    pub authority: Pubkey,
    pub pool_fee: u64,
    pub pool_fee_denominator: u64,
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub token_a_amount: u64,
    pub token_b_amount: u64,
    pub lp_supply: u64,
}

// Safe version of calculate_swap_output with proper error handling
fn calculate_swap_output_safe(
    amount_in: u64,
    reserve_in: u64,
    reserve_out: u64,
    fee: u64,
    fee_denominator: u64,
) -> Result<u64> {
    // Validate inputs
    require!(amount_in > 0, AmmError::InvalidAmount);
    require!(reserve_in > 0, AmmError::InsufficientLiquidity);
    require!(reserve_out > 0, AmmError::InsufficientLiquidity);
    require!(fee < fee_denominator, AmmError::InvalidFee);
    
    // Calculate fee-adjusted input amount
    let fee_multiplier = fee_denominator
        .checked_sub(fee)
        .ok_or(AmmError::MathOverflow)?;
        
    let amount_in_with_fee = (amount_in as u128)
        .checked_mul(fee_multiplier as u128)
        .ok_or(AmmError::MathOverflow)?;
    
    // Calculate output using constant product formula: x * y = k
    let numerator = amount_in_with_fee
        .checked_mul(reserve_out as u128)
        .ok_or(AmmError::MathOverflow)?;
        
    let denominator_base = (reserve_in as u128)
        .checked_mul(fee_denominator as u128)
        .ok_or(AmmError::MathOverflow)?;
        
    let denominator = denominator_base
        .checked_add(amount_in_with_fee)
        .ok_or(AmmError::MathOverflow)?;
    
    if denominator == 0 {
        return Err(AmmError::MathOverflow.into());
    }
    
    let amount_out = numerator
        .checked_div(denominator)
        .ok_or(AmmError::MathOverflow)?;
    
    // Ensure result fits in u64
    if amount_out > u64::MAX as u128 {
        return Err(AmmError::MathOverflow.into());
    }
    
    let result = amount_out as u64;
    
    // Ensure we don't drain the pool
    require!(result < reserve_out, AmmError::InsufficientLiquidity);
    
    msg!("Swap calculation: in={}, reserve_in={}, reserve_out={}, out={}", 
         amount_in, reserve_in, reserve_out, result);
    
    Ok(result)
}

#[error_code]
pub enum AmmError {
    #[msg("Invalid amount provided")]
    InvalidAmount,
    #[msg("Insufficient liquidity in the pool")]
    InsufficientLiquidity,
    #[msg("Insufficient output amount")]
    InsufficientOutputAmount,
    #[msg("Math operation overflow")]
    MathOverflow,
    #[msg("Invalid fee configuration")]
    InvalidFee,
}
