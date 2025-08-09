use anchor_lang::prelude::*;
use anchor_spl::token_2022::{
    Token2022, TransferChecked, transfer_checked,
};
use anchor_spl::token_interface::{Mint, TokenAccount};
use spl_token_2022::onchain::invoke_transfer_checked;

declare_id!("6vL4UPFu43VpdcD8jBs8F4AvtaMtDxkEWMNpZJZtueYM");

#[program]
pub mod token_2022_amm {
    use super::*;

    /// Initialize the AMM (simplified - just creates the AMM account)
    pub fn initialize_amm(
        ctx: Context<InitializeAmm>,
        pool_fee: u64,
        pool_fee_denominator: u64,
    ) -> Result<()> {
        let amm = &mut ctx.accounts.amm;
        amm.authority = ctx.accounts.authority.key();
        amm.pool_fee = pool_fee;
        amm.pool_fee_denominator = pool_fee_denominator;
        amm.bump = ctx.bumps.amm;
        // Initialize other fields as zero/default - they'll be set when pools are created
        amm.token_a_mint = Pubkey::default();
        amm.token_b_mint = Pubkey::default();
        amm.token_a_vault = Pubkey::default();
        amm.token_b_vault = Pubkey::default();
        amm.lp_mint = Pubkey::default();
        
        msg!("AMM initialized successfully");
        Ok(())
    }

    /// Set token pair configuration for AMM
    pub fn set_token_pair(
        ctx: Context<SetTokenPair>,
        token_a_mint: Pubkey,
        token_b_mint: Pubkey,
        token_a_vault: Pubkey,
        token_b_vault: Pubkey,
        lp_mint: Pubkey,
    ) -> Result<()> {
        let amm = &mut ctx.accounts.amm;
        amm.token_a_mint = token_a_mint;
        amm.token_b_mint = token_b_mint;
        amm.token_a_vault = token_a_vault;
        amm.token_b_vault = token_b_vault;
        amm.lp_mint = lp_mint;

        msg!("Token pair configuration set");
        Ok(())
    }

    /// Create a new liquidity pool (simplified)
    pub fn create_pool(
        ctx: Context<CreatePool>,
        initial_token_a_amount: u64,
        initial_token_b_amount: u64,
    ) -> Result<()> {
        // Prepare all accounts for transfer hook resolution
        let all_accounts = vec![
            ctx.accounts.pool.to_account_info(),
            ctx.accounts.amm.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.user_token_a.to_account_info(),
            ctx.accounts.user_token_b.to_account_info(),
            ctx.accounts.token_a_mint.to_account_info(),
            ctx.accounts.token_b_mint.to_account_info(),
            ctx.accounts.token_a_vault.to_account_info(),
            ctx.accounts.token_b_vault.to_account_info(),
            ctx.accounts.token_a_extra_metas.to_account_info(),
            ctx.accounts.token_b_extra_metas.to_account_info(),
            ctx.accounts.transfer_hook_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ];
        
        // Transfer token A using transfer hook compatible function
        invoke_transfer_checked(
            &ctx.accounts.token_program.key(),
            ctx.accounts.user_token_a.to_account_info(),
            ctx.accounts.token_a_mint.to_account_info(),
            ctx.accounts.token_a_vault.to_account_info(),
            ctx.accounts.user.to_account_info(),
            &all_accounts,
            initial_token_a_amount,
            ctx.accounts.token_a_mint.decimals,
            &[],
        )?;

        // Transfer token B using transfer hook compatible function
        invoke_transfer_checked(
            &ctx.accounts.token_program.key(),
            ctx.accounts.user_token_b.to_account_info(),
            ctx.accounts.token_b_mint.to_account_info(),
            ctx.accounts.token_b_vault.to_account_info(),
            ctx.accounts.user.to_account_info(),
            &all_accounts,
            initial_token_b_amount,
            ctx.accounts.token_b_mint.decimals,
            &[],
        )?;

        // Initialize pool state with consistent token ordering
        let pool = &mut ctx.accounts.pool;
        let (token_min, token_max, amount_min, amount_max) = if ctx.accounts.token_a_mint.key() < ctx.accounts.token_b_mint.key() {
            (ctx.accounts.token_a_mint.key(), ctx.accounts.token_b_mint.key(), initial_token_a_amount, initial_token_b_amount)
        } else {
            (ctx.accounts.token_b_mint.key(), ctx.accounts.token_a_mint.key(), initial_token_b_amount, initial_token_a_amount)
        };
        
        pool.token_a_mint = token_min;
        pool.token_b_mint = token_max;
        pool.token_a_amount = amount_min;
        pool.token_b_amount = amount_max;
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
        // Prepare all accounts for transfer hook resolution (before mutable borrow)
        let all_accounts = vec![
            ctx.accounts.pool.to_account_info(),
            ctx.accounts.amm.to_account_info(),
            ctx.accounts.user.to_account_info(),
            ctx.accounts.user_token_in.to_account_info(),
            ctx.accounts.user_token_out.to_account_info(),
            ctx.accounts.token_in_mint.to_account_info(),
            ctx.accounts.token_out_mint.to_account_info(),
            ctx.accounts.token_in_vault.to_account_info(),
            ctx.accounts.token_out_vault.to_account_info(),
            ctx.accounts.token_in_extra_metas.to_account_info(),
            ctx.accounts.token_out_extra_metas.to_account_info(),
            ctx.accounts.transfer_hook_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ];
        
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

        // Transfer tokens from user to vault using transfer hook compatible function
        invoke_transfer_checked(
            &ctx.accounts.token_program.key(),
            ctx.accounts.user_token_in.to_account_info(),
            ctx.accounts.token_in_mint.to_account_info(),
            ctx.accounts.token_in_vault.to_account_info(),
            ctx.accounts.user.to_account_info(),
            &all_accounts,
            amount_in,
            ctx.accounts.token_in_mint.decimals,
            &[],
        )?;

        // Transfer tokens from vault to user using transfer hook compatible function
        let amm_seeds = &[b"amm".as_ref(), &[ctx.accounts.amm.bump]];
        let signer_seeds = [&amm_seeds[..]];
        
        invoke_transfer_checked(
            &ctx.accounts.token_program.key(),
            ctx.accounts.token_out_vault.to_account_info(),
            ctx.accounts.token_out_mint.to_account_info(),
            ctx.accounts.user_token_out.to_account_info(),
            ctx.accounts.amm.to_account_info(),
            &all_accounts,
            amount_out,
            ctx.accounts.token_out_mint.decimals,
            &signer_seeds,
        )?;

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
        let amm_seeds = &[b"amm".as_ref(), &[ctx.accounts.amm.bump]];
        let signer_seeds = &[&amm_seeds[..]];
        
        let mint_lp_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            anchor_spl::token_2022::MintTo {
                mint: ctx.accounts.lp_mint.to_account_info(),
                to: ctx.accounts.user_lp_token.to_account_info(),
                authority: ctx.accounts.amm.to_account_info(),
            },
            signer_seeds,
        );
        anchor_spl::token_2022::mint_to(mint_lp_ctx, lp_tokens_to_mint)?;

        // Update pool balances
        pool.token_a_amount = pool.token_a_amount.checked_add(token_a_amount).unwrap();
        pool.token_b_amount = pool.token_b_amount.checked_add(token_b_amount).unwrap();
        pool.lp_supply = pool.lp_supply.checked_add(lp_tokens_to_mint).unwrap();

        msg!("Liquidity added: {} LP tokens minted", lp_tokens_to_mint);
        Ok(())
    }

    /// Initialize the hook whitelist
    pub fn initialize_whitelist(ctx: Context<InitializeWhitelist>) -> Result<()> {
        let wl = &mut ctx.accounts.whitelist;
        wl.amm = ctx.accounts.amm.key();
        wl.allowed = Vec::new();
        Ok(())
    }

    /// Add a hook program to the whitelist
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

    /// Remove a hook program from the whitelist
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
pub struct InitializeAmm<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Amm::INIT_SPACE,
        seeds = [b"amm"],
        bump
    )]
    pub amm: Account<'info, Amm>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetTokenPair<'info> {
    #[account(mut)]
    pub amm: Account<'info, Amm>,
    
    // Remove authority constraint - allow anyone to create pools
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + Pool::INIT_SPACE,
        seeds = [b"pool", token_a_mint.key().as_ref(), token_b_mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,
    
    pub amm: Account<'info, Amm>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub user_token_a: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_b: InterfaceAccount<'info, TokenAccount>,
    
    pub token_a_mint: InterfaceAccount<'info, Mint>,
    pub token_b_mint: InterfaceAccount<'info, Mint>,
    
    #[account(mut)]
    pub token_a_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub token_b_vault: InterfaceAccount<'info, TokenAccount>,
    
    /// CHECK: Extra account metas for token A transfer hook
    #[account(
        seeds = [b"extra-account-metas", token_a_mint.key().as_ref()],
        bump,
        seeds::program = transfer_hook_program
    )]
    pub token_a_extra_metas: AccountInfo<'info>,
    
    /// CHECK: Extra account metas for token B transfer hook  
    #[account(
        seeds = [b"extra-account-metas", token_b_mint.key().as_ref()],
        bump,
        seeds::program = transfer_hook_program
    )]
    pub token_b_extra_metas: AccountInfo<'info>,
    
    /// CHECK: Transfer hook program
    pub transfer_hook_program: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(
        mut,
        constraint = pool.token_a_mint == if token_in_mint.key() < token_out_mint.key() { token_in_mint.key() } else { token_out_mint.key() } @ AmmError::InvalidTokenPair,
        constraint = pool.token_b_mint == if token_in_mint.key() < token_out_mint.key() { token_out_mint.key() } else { token_in_mint.key() } @ AmmError::InvalidTokenPair
    )]
    pub pool: Account<'info, Pool>,
    pub amm: Account<'info, Amm>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub user_token_in: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_out: InterfaceAccount<'info, TokenAccount>,
    
    pub token_in_mint: InterfaceAccount<'info, Mint>,
    pub token_out_mint: InterfaceAccount<'info, Mint>,
    
    #[account(mut)]
    pub token_in_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub token_out_vault: InterfaceAccount<'info, TokenAccount>,
    
    /// CHECK: Extra account metas for token in transfer hook
    #[account(
        seeds = [b"extra-account-metas", token_in_mint.key().as_ref()],
        bump,
        seeds::program = transfer_hook_program
    )]
    pub token_in_extra_metas: AccountInfo<'info>,
    
    /// CHECK: Extra account metas for token out transfer hook  
    #[account(
        seeds = [b"extra-account-metas", token_out_mint.key().as_ref()],
        bump,
        seeds::program = transfer_hook_program
    )]
    pub token_out_extra_metas: AccountInfo<'info>,
    
    /// CHECK: Transfer hook program
    pub transfer_hook_program: AccountInfo<'info>,
    
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
    pub user_token_a: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_b: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub user_lp_token: InterfaceAccount<'info, TokenAccount>,
    
    pub token_a_mint: InterfaceAccount<'info, Mint>,
    pub token_b_mint: InterfaceAccount<'info, Mint>,
    
    #[account(mut)]
    pub token_a_vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub token_b_vault: InterfaceAccount<'info, TokenAccount>,
    
    #[account(mut)]
    pub lp_mint: InterfaceAccount<'info, Mint>,
    
    pub token_program: Program<'info, Token2022>,
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
    pub token_a_mint: Pubkey,  // Always the smaller mint key
    pub token_b_mint: Pubkey,  // Always the larger mint key
    pub token_a_amount: u64,
    pub token_b_amount: u64,
    pub lp_supply: u64,
    pub bump: u8,
}

#[account]
pub struct HookWhitelist {
    pub amm: Pubkey,
    pub allowed: Vec<Pubkey>,
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
    #[msg("Invalid token pair for pool")]
    InvalidTokenPair,
}

fn calculate_swap_output(
    amount_in: u64,
    reserve_in: u64,
    reserve_out: u64,
    fee: u64,
    fee_denominator: u64,
) -> Result<u64> {
    // Use u128 to prevent overflow in intermediate calculations
    let amount_in = amount_in as u128;
    let reserve_in = reserve_in as u128;
    let reserve_out = reserve_out as u128;
    let fee = fee as u128;
    let fee_denominator = fee_denominator as u128;
    
    let fee_multiplier = fee_denominator.checked_sub(fee)
        .ok_or(AmmError::InvalidSwapCalculation)?;
    
    let amount_in_with_fee = amount_in.checked_mul(fee_multiplier)
        .ok_or(AmmError::InvalidSwapCalculation)?;
    
    let numerator = amount_in_with_fee.checked_mul(reserve_out)
        .ok_or(AmmError::InvalidSwapCalculation)?;
    
    let denominator = reserve_in.checked_mul(fee_denominator)
        .ok_or(AmmError::InvalidSwapCalculation)?
        .checked_add(amount_in_with_fee)
        .ok_or(AmmError::InvalidSwapCalculation)?;
    
    let amount_out = numerator.checked_div(denominator)
        .ok_or(AmmError::InvalidSwapCalculation)?;
    
    // Convert back to u64, checking for overflow
    u64::try_from(amount_out).map_err(|_| AmmError::InvalidSwapCalculation.into())
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

