//! james registry: the on-chain half of the Parkinson's research notebook.
//!
//! * A prediction (gene, cell group, outcome) is registered by hash before any data is read. The
//!   PDA is seeded by that hash, so each prediction can be registered exactly once, and the block
//!   time is the public proof that it was sealed before the result existed.
//! * The agent (registry authority) is the oracle: it writes the split-half result back.
//! * Replicated predictions made by a wallet earn test tokens, minted by the registry PDA.
//! * The off-chain receipt hash chain is checkpointed here so its head cannot be rewritten.
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

declare_id!("CfMeJtdS8jajhhFkNiguhLa3tjXBZdSJoKB3teWkxuYb");

pub const GENE_LEN: usize = 16;
pub const TOKEN_DECIMALS: u8 = 6;

pub const STATUS_PENDING: u8 = 0;
pub const STATUS_REPLICATED: u8 = 1;
pub const STATUS_FAILED: u8 = 2;

#[program]
pub mod james_registry {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, reward_amount: u64, faucet_amount: u64) -> Result<()> {
        let r = &mut ctx.accounts.registry;
        r.authority = ctx.accounts.authority.key();
        r.mint = ctx.accounts.mint.key();
        r.bump = ctx.bumps.registry;
        r.mint_bump = ctx.bumps.mint;
        r.reward_amount = reward_amount;
        r.faucet_amount = faucet_amount;
        Ok(())
    }

    pub fn register_prediction(
        ctx: Context<RegisterPrediction>,
        hash: [u8; 32],
        gene: [u8; GENE_LEN],
        group: u8,
        axis: u8,
    ) -> Result<()> {
        require!(gene[0] != 0, RegistryError::EmptyGene);
        let clock = Clock::get()?;
        let p = &mut ctx.accounts.prediction;
        p.hash = hash;
        p.predictor = ctx.accounts.predictor.key();
        p.gene = gene;
        p.group = group;
        p.axis = axis;
        p.registered_at = clock.unix_timestamp;
        p.slot = clock.slot;
        p.status = STATUS_PENDING;
        p.bump = ctx.bumps.prediction;

        let r = &mut ctx.accounts.registry;
        r.predictions = r.predictions.checked_add(1).unwrap();

        emit!(PredictionRegistered { hash, predictor: p.predictor, registered_at: p.registered_at });
        Ok(())
    }

    /// Oracle write: the split-half result. Effects are Spearman / rank-biserial values x 10_000.
    pub fn resolve_prediction(
        ctx: Context<ResolvePrediction>,
        passed: bool,
        effect_discovery: i16,
        effect_replication: i16,
        receipt_no: u32,
    ) -> Result<()> {
        let p = &mut ctx.accounts.prediction;
        require!(p.status == STATUS_PENDING, RegistryError::AlreadyResolved);
        let clock = Clock::get()?;
        p.status = if passed { STATUS_REPLICATED } else { STATUS_FAILED };
        p.effect_discovery = effect_discovery;
        p.effect_replication = effect_replication;
        p.receipt_no = receipt_no;
        p.resolved_at = clock.unix_timestamp;

        let r = &mut ctx.accounts.registry;
        r.resolved = r.resolved.checked_add(1).unwrap();
        if passed {
            r.replicated = r.replicated.checked_add(1).unwrap();
        }
        emit!(PredictionResolved { hash: p.hash, passed, effect_discovery, effect_replication, receipt_no });
        Ok(())
    }

    /// Mints the reward once per replicated prediction to the wallet that registered it.
    pub fn reward_predictor(ctx: Context<RewardPredictor>) -> Result<()> {
        let p = &mut ctx.accounts.prediction;
        require!(p.status == STATUS_REPLICATED, RegistryError::NotReplicated);
        require!(!p.rewarded, RegistryError::AlreadyRewarded);
        p.rewarded = true;

        let r = &ctx.accounts.registry;
        let seeds: &[&[u8]] = &[b"registry", &[r.bump]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.predictor_ata.to_account_info(),
                    authority: ctx.accounts.registry.to_account_info(),
                },
                &[seeds],
            ),
            r.reward_amount,
        )?;
        emit!(PredictorRewarded { hash: p.hash, predictor: p.predictor, amount: r.reward_amount });
        Ok(())
    }

    /// Checkpoints the head of the off-chain receipt hash chain. Heads only move forward.
    pub fn anchor_receipts(ctx: Context<AuthorityOnly>, head_no: u64, head_hash: [u8; 32]) -> Result<()> {
        let r = &mut ctx.accounts.registry;
        require!(head_no > r.receipt_head_no, RegistryError::StaleCheckpoint);
        r.receipt_head_no = head_no;
        r.receipt_head_hash = head_hash;
        r.anchored_at = Clock::get()?.unix_timestamp;
        emit!(ReceiptsAnchored { head_no, head_hash, at: r.anchored_at });
        Ok(())
    }

    /// Test-token faucet. The agent rate-limits who it signs this for.
    pub fn faucet(ctx: Context<Faucet>) -> Result<()> {
        let r = &ctx.accounts.registry;
        let seeds: &[&[u8]] = &[b"registry", &[r.bump]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.recipient_ata.to_account_info(),
                    authority: ctx.accounts.registry.to_account_info(),
                },
                &[seeds],
            ),
            r.faucet_amount,
        )?;
        Ok(())
    }

    pub fn set_authority(ctx: Context<AuthorityOnly>, new_authority: Pubkey) -> Result<()> {
        ctx.accounts.registry.authority = new_authority;
        Ok(())
    }
}

// ------------------------------------------------------------------ accounts

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + Registry::INIT_SPACE, seeds = [b"registry"], bump)]
    pub registry: Account<'info, Registry>,
    #[account(
        init,
        payer = authority,
        seeds = [b"mint"],
        bump,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = registry,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(hash: [u8; 32])]
pub struct RegisterPrediction<'info> {
    #[account(mut, seeds = [b"registry"], bump = registry.bump)]
    pub registry: Account<'info, Registry>,
    #[account(
        init,
        payer = payer,
        space = 8 + Prediction::INIT_SPACE,
        seeds = [b"prediction", hash.as_ref()],
        bump,
    )]
    pub prediction: Account<'info, Prediction>,
    pub predictor: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolvePrediction<'info> {
    #[account(mut, seeds = [b"registry"], bump = registry.bump, has_one = authority @ RegistryError::Unauthorized)]
    pub registry: Account<'info, Registry>,
    #[account(mut, seeds = [b"prediction", prediction.hash.as_ref()], bump = prediction.bump)]
    pub prediction: Account<'info, Prediction>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RewardPredictor<'info> {
    #[account(seeds = [b"registry"], bump = registry.bump, has_one = authority @ RegistryError::Unauthorized, has_one = mint)]
    pub registry: Account<'info, Registry>,
    #[account(mut, seeds = [b"prediction", prediction.hash.as_ref()], bump = prediction.bump)]
    pub prediction: Account<'info, Prediction>,
    #[account(mut, seeds = [b"mint"], bump = registry.mint_bump)]
    pub mint: Account<'info, Mint>,
    /// CHECK: owner of the reward account, pinned to the wallet that registered the prediction.
    #[account(address = prediction.predictor @ RegistryError::WrongPredictor)]
    pub predictor: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = predictor,
    )]
    pub predictor_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Faucet<'info> {
    #[account(seeds = [b"registry"], bump = registry.bump, has_one = authority @ RegistryError::Unauthorized, has_one = mint)]
    pub registry: Account<'info, Registry>,
    #[account(mut, seeds = [b"mint"], bump = registry.mint_bump)]
    pub mint: Account<'info, Mint>,
    /// CHECK: any wallet can receive test tokens.
    pub recipient: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = recipient,
    )]
    pub recipient_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AuthorityOnly<'info> {
    #[account(mut, seeds = [b"registry"], bump = registry.bump, has_one = authority @ RegistryError::Unauthorized)]
    pub registry: Account<'info, Registry>,
    pub authority: Signer<'info>,
}

// ------------------------------------------------------------------ state

#[account]
#[derive(InitSpace)]
pub struct Registry {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub bump: u8,
    pub mint_bump: u8,
    pub predictions: u64,
    pub resolved: u64,
    pub replicated: u64,
    pub receipt_head_no: u64,
    pub receipt_head_hash: [u8; 32],
    pub anchored_at: i64,
    pub reward_amount: u64,
    pub faucet_amount: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Prediction {
    pub hash: [u8; 32],
    pub predictor: Pubkey,
    pub gene: [u8; GENE_LEN],
    pub group: u8,
    pub axis: u8,
    pub registered_at: i64,
    pub slot: u64,
    pub status: u8,
    pub effect_discovery: i16,
    pub effect_replication: i16,
    pub receipt_no: u32,
    pub resolved_at: i64,
    pub rewarded: bool,
    pub bump: u8,
}

// ------------------------------------------------------------------ events and errors

#[event]
pub struct PredictionRegistered {
    pub hash: [u8; 32],
    pub predictor: Pubkey,
    pub registered_at: i64,
}

#[event]
pub struct PredictionResolved {
    pub hash: [u8; 32],
    pub passed: bool,
    pub effect_discovery: i16,
    pub effect_replication: i16,
    pub receipt_no: u32,
}

#[event]
pub struct PredictorRewarded {
    pub hash: [u8; 32],
    pub predictor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ReceiptsAnchored {
    pub head_no: u64,
    pub head_hash: [u8; 32],
    pub at: i64,
}

#[error_code]
pub enum RegistryError {
    #[msg("only the registry authority can do this")]
    Unauthorized,
    #[msg("the prediction already has a result")]
    AlreadyResolved,
    #[msg("only replicated predictions earn a reward")]
    NotReplicated,
    #[msg("this prediction was already rewarded")]
    AlreadyRewarded,
    #[msg("receipt checkpoints only move forward")]
    StaleCheckpoint,
    #[msg("gene symbol is empty")]
    EmptyGene,
    #[msg("reward account owner is not the predictor")]
    WrongPredictor,
}
