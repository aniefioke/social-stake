;; SocialStake Protocol - Trust-Based Social Finance on Bitcoin
;;
;; Title: SocialStake - Decentralized Trust Networks with Economic Incentives
;;
;; Summary:
;; SocialStake revolutionizes social interaction by creating economically-backed
;; trust networks on Bitcoin's Layer 2. Members stake STX tokens to join exclusive
;; communities, earning reputation through positive interactions and governing
;; collective decisions through weighted voting mechanisms.
;;
;; Description:
;; Built on Stacks blockchain for Bitcoin-grade security, SocialStake introduces
;; a novel social finance paradigm where trust becomes quantifiable and reputation
;; becomes valuable. The protocol features stake-backed membership, reputation
;; mining through social interactions, decentralized governance with economic
;; incentives, automated escrow management, and transferable social capital.
;;
;; Key innovations include skin-in-the-game dynamics that align economic incentives
;; with social behavior, creating the first truly sustainable social network where
;; good actors are rewarded and bad actors face economic consequences. This bridges
;; the gap between social networks and decentralized finance on Bitcoin.

;; CONSTANTS & CONFIGURATION

(define-constant CONTRACT_OWNER tx-sender)

;; Error Management
(define-constant ERR_UNAUTHORIZED (err u401))
(define-constant ERR_INVALID_PARAMS (err u400))
(define-constant ERR_CIRCLE_NOT_FOUND (err u404))
(define-constant ERR_ALREADY_MEMBER (err u409))
(define-constant ERR_NOT_MEMBER (err u403))
(define-constant ERR_INSUFFICIENT_STAKE (err u402))
(define-constant ERR_INSUFFICIENT_BALANCE (err u405))
(define-constant ERR_PROPOSAL_NOT_FOUND (err u406))
(define-constant ERR_VOTING_CLOSED (err u407))
(define-constant ERR_ALREADY_VOTED (err u408))
(define-constant ERR_INVALID_VOTE (err u410))

;; Economic Parameters
(define-constant MIN_CIRCLE_STAKE u1000000) ;; 1 STX minimum stake
(define-constant MIN_MEMBER_STAKE u100000) ;; 0.1 STX minimum member stake
(define-constant MAX_REPUTATION_TRANSFER u1000) ;; Maximum reputation per transfer
(define-constant MAX_PROPOSAL_AMOUNT u10000000) ;; 10 STX maximum proposal amount
(define-constant REPUTATION_BONUS u10) ;; Joining bonus reputation

;; Governance Configuration
(define-constant VOTING_PERIOD u1440) ;; 24 hours in blocks (~10min blocks)
(define-constant QUORUM_THRESHOLD u60) ;; 60% participation required
(define-constant REPUTATION_WEIGHT u100) ;; Base reputation multiplier

;; DATA STRUCTURES

;; Trust Circle Registry
(define-map trust-circles
  { circle-id: uint }
  {
    name: (string-ascii 64),
    creator: principal,
    is-public: bool,
    stake-threshold: uint,
    total-staked: uint,
    member-count: uint,
    created-at: uint,
    reputation-weight: uint,
  }
)

;; Member Registry
(define-map circle-members
  {
    circle-id: uint,
    member: principal,
  }
  {
    stake-amount: uint,
    reputation-score: uint,
    joined-at: uint,
    last-activity: uint,
    is-active: bool,
  }
)

;; Global Reputation System
(define-map user-reputation
  { user: principal }
  {
    total-reputation: uint,
    circles-joined: uint,
    total-staked: uint,
    last-updated: uint,
  }
)

;; Stake Escrow System
(define-map escrow-balances
  {
    user: principal,
    circle-id: uint,
  }
  { amount: uint }
)