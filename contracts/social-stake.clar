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

;; Governance Proposals
(define-map governance-proposals
  { proposal-id: uint }
  {
    circle-id: uint,
    proposer: principal,
    proposal-type: (string-ascii 32),
    target: (optional principal),
    amount: uint,
    description: (string-ascii 256),
    votes-for: uint,
    votes-against: uint,
    total-votes: uint,
    created-at: uint,
    expires-at: uint,
    executed: bool,
  }
)

;; Voting Records
(define-map member-votes
  {
    proposal-id: uint,
    voter: principal,
  }
  {
    vote: bool,
    weight: uint,
    timestamp: uint,
  }
)

;; STATE VARIABLES

(define-data-var next-circle-id uint u1)
(define-data-var next-proposal-id uint u1)
(define-data-var protocol-fee uint u50) ;; 0.5% protocol fee

;; VALIDATION HELPERS

(define-private (is-circle-member
    (circle-id uint)
    (user principal)
  )
  (is-some (map-get? circle-members {
    circle-id: circle-id,
    member: user,
  }))
)

(define-private (get-member-reputation
    (circle-id uint)
    (member principal)
  )
  (default-to u0
    (get reputation-score
      (map-get? circle-members {
        circle-id: circle-id,
        member: member,
      })
    ))
)

(define-private (calculate-voting-weight
    (circle-id uint)
    (voter principal)
  )
  (let ((member-data (map-get? circle-members {
      circle-id: circle-id,
      member: voter,
    })))
    (match member-data
      data (+ (get stake-amount data) (get reputation-score data))
      u0
    )
  )
)

(define-private (update-user-reputation
    (user principal)
    (reputation-change int)
  )
  (let ((current-rep (default-to {
      total-reputation: u0,
      circles-joined: u0,
      total-staked: u0,
      last-updated: u0,
    }
      (map-get? user-reputation { user: user })
    )))
    (map-set user-reputation { user: user }
      (merge current-rep {
        total-reputation: (if (>= reputation-change 0)
          (+ (get total-reputation current-rep) (to-uint reputation-change))
          (if (> (get total-reputation current-rep) (to-uint (- reputation-change)))
            (- (get total-reputation current-rep) (to-uint (- reputation-change)))
            u0
          )
        ),
        last-updated: stacks-block-height,
      })
    )
  )
)

(define-private (validate-circle-exists (circle-id uint))
  (is-some (map-get? trust-circles { circle-id: circle-id }))
)

(define-private (validate-proposal-exists (proposal-id uint))
  (is-some (map-get? governance-proposals { proposal-id: proposal-id }))
)

(define-private (validate-proposal-type (proposal-type (string-ascii 32)))
  (or
    (is-eq proposal-type "slash")
    (is-eq proposal-type "reward")
    (is-eq proposal-type "kick")
    (is-eq proposal-type "upgrade")
  )
)

;; CORE CIRCLE MANAGEMENT

(define-public (create-trust-circle
    (name (string-ascii 64))
    (is-public bool)
    (stake-threshold uint)
  )
  (let ((circle-id (var-get next-circle-id)))
    ;; Input validation
    (asserts! (>= stake-threshold MIN_CIRCLE_STAKE) ERR_INVALID_PARAMS)
    (asserts! (and (> (len name) u0) (<= (len name) u64)) ERR_INVALID_PARAMS)

    ;; Create circle record
    (map-set trust-circles { circle-id: circle-id } {
      name: name,
      creator: tx-sender,
      is-public: is-public,
      stake-threshold: stake-threshold,
      total-staked: u0,
      member-count: u0,
      created-at: stacks-block-height,
      reputation-weight: REPUTATION_WEIGHT,
    })

    ;; Auto-join creator as founding member
    (try! (join-trust-circle circle-id stake-threshold))

    ;; Increment counter
    (var-set next-circle-id (+ circle-id u1))
    (ok circle-id)
  )
)

(define-public (join-trust-circle
    (circle-id uint)
    (stake-amount uint)
  )
  (let ((circle (unwrap! (map-get? trust-circles { circle-id: circle-id })
      ERR_CIRCLE_NOT_FOUND
    )))
    ;; Validation checks
    (asserts! (not (is-circle-member circle-id tx-sender)) ERR_ALREADY_MEMBER)
    (asserts! (>= stake-amount (get stake-threshold circle))
      ERR_INSUFFICIENT_STAKE
    )
    (asserts! (>= (stx-get-balance tx-sender) stake-amount)
      ERR_INSUFFICIENT_BALANCE
    )

    ;; Transfer stake to escrow
    (try! (stx-transfer? stake-amount tx-sender (as-contract tx-sender)))

    ;; Record escrowed amount
    (map-set escrow-balances {
      user: tx-sender,
      circle-id: circle-id,
    } { amount: stake-amount }
    )

    ;; Add member to circle
    (map-set circle-members {
      circle-id: circle-id,
      member: tx-sender,
    } {
      stake-amount: stake-amount,
      reputation-score: u0,
      joined-at: stacks-block-height,
      last-activity: stacks-block-height,
      is-active: true,
    })

    ;; Update circle statistics
    (map-set trust-circles { circle-id: circle-id }
      (merge circle {
        total-staked: (+ (get total-staked circle) stake-amount),
        member-count: (+ (get member-count circle) u1),
      })
    )

    ;; Award joining bonus reputation
    (update-user-reputation tx-sender (to-int REPUTATION_BONUS))
    (ok true)
  )
)