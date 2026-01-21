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

(define-public (leave-trust-circle (circle-id uint))
  (let (
      (circle (unwrap! (map-get? trust-circles { circle-id: circle-id })
        ERR_CIRCLE_NOT_FOUND
      ))
      (member-data (unwrap!
        (map-get? circle-members {
          circle-id: circle-id,
          member: tx-sender,
        })
        ERR_NOT_MEMBER
      ))
      (escrow-data (unwrap!
        (map-get? escrow-balances {
          user: tx-sender,
          circle-id: circle-id,
        })
        ERR_NOT_MEMBER
      ))
    )
    ;; Return staked amount from escrow
    (try! (as-contract (stx-transfer? (get amount escrow-data) tx-sender tx-sender)))

    ;; Clean up records
    (map-delete circle-members {
      circle-id: circle-id,
      member: tx-sender,
    })
    (map-delete escrow-balances {
      user: tx-sender,
      circle-id: circle-id,
    })

    ;; Update circle statistics
    (map-set trust-circles { circle-id: circle-id }
      (merge circle {
        total-staked: (- (get total-staked circle) (get stake-amount member-data)),
        member-count: (- (get member-count circle) u1),
      })
    )
    (ok true)
  )
)

;; REPUTATION & SOCIAL CAPITAL SYSTEM

(define-public (endorse-member
    (circle-id uint)
    (target principal)
    (amount uint)
  )
  (let (
      (endorser-data (unwrap!
        (map-get? circle-members {
          circle-id: circle-id,
          member: tx-sender,
        })
        ERR_NOT_MEMBER
      ))
      (target-data (unwrap!
        (map-get? circle-members {
          circle-id: circle-id,
          member: target,
        })
        ERR_NOT_MEMBER
      ))
    )
    ;; Validation
    (asserts! (validate-circle-exists circle-id) ERR_CIRCLE_NOT_FOUND)
    (asserts! (and (> amount u0) (<= amount MAX_REPUTATION_TRANSFER))
      ERR_INVALID_PARAMS
    )
    (asserts! (>= (get reputation-score endorser-data) amount)
      ERR_INSUFFICIENT_BALANCE
    )
    (asserts! (not (is-eq tx-sender target)) ERR_INVALID_PARAMS)

    ;; Transfer reputation
    (map-set circle-members {
      circle-id: circle-id,
      member: tx-sender,
    }
      (merge endorser-data {
        reputation-score: (- (get reputation-score endorser-data) amount),
        last-activity: stacks-block-height,
      })
    )

    (map-set circle-members {
      circle-id: circle-id,
      member: target,
    }
      (merge target-data {
        reputation-score: (+ (get reputation-score target-data) amount),
        last-activity: stacks-block-height,
      })
    )

    ;; Update global reputation
    (update-user-reputation target (to-int amount))
    (ok true)
  )
)

(define-public (reward-member
    (circle-id uint)
    (target principal)
    (amount uint)
  )
  (let ((member-data (unwrap!
      (map-get? circle-members {
        circle-id: circle-id,
        member: target,
      })
      ERR_NOT_MEMBER
    )))
    ;; Validation
    (asserts! (validate-circle-exists circle-id) ERR_CIRCLE_NOT_FOUND)
    (asserts! (and (> amount u0) (<= amount MAX_REPUTATION_TRANSFER))
      ERR_INVALID_PARAMS
    )
    (asserts! (is-circle-member circle-id tx-sender) ERR_NOT_MEMBER)

    ;; Update reputation
    (map-set circle-members {
      circle-id: circle-id,
      member: target,
    }
      (merge member-data { reputation-score: (+ (get reputation-score member-data) amount) })
    )

    (update-user-reputation target (to-int amount))
    (ok true)
  )
)

;; DECENTRALIZED GOVERNANCE SYSTEM

(define-public (create-proposal
    (circle-id uint)
    (proposal-type (string-ascii 32))
    (target (optional principal))
    (amount uint)
    (description (string-ascii 256))
  )
  (let ((proposal-id (var-get next-proposal-id)))
    ;; Comprehensive validation
    (asserts! (validate-circle-exists circle-id) ERR_CIRCLE_NOT_FOUND)
    (asserts! (is-circle-member circle-id tx-sender) ERR_NOT_MEMBER)
    (asserts! (validate-proposal-type proposal-type) ERR_INVALID_PARAMS)
    (asserts! (and (> amount u0) (<= amount MAX_PROPOSAL_AMOUNT))
      ERR_INVALID_PARAMS
    )
    (asserts! (and (> (len description) u0) (<= (len description) u256))
      ERR_INVALID_PARAMS
    )

    ;; Validate target if provided
    (match target
      target-principal (asserts! (is-circle-member circle-id target-principal) ERR_NOT_MEMBER)
      true
    )

    ;; Create proposal
    (map-set governance-proposals { proposal-id: proposal-id } {
      circle-id: circle-id,
      proposer: tx-sender,
      proposal-type: proposal-type,
      target: target,
      amount: amount,
      description: description,
      votes-for: u0,
      votes-against: u0,
      total-votes: u0,
      created-at: stacks-block-height,
      expires-at: (+ stacks-block-height VOTING_PERIOD),
      executed: false,
    })

    (var-set next-proposal-id (+ proposal-id u1))
    (ok proposal-id)
  )
)

(define-public (vote-on-proposal
    (proposal-id uint)
    (vote-for bool)
  )
  (let (
      (proposal (unwrap! (map-get? governance-proposals { proposal-id: proposal-id })
        ERR_PROPOSAL_NOT_FOUND
      ))
      (voting-weight (calculate-voting-weight (get circle-id proposal) tx-sender))
    )
    ;; Validation
    (asserts! (is-circle-member (get circle-id proposal) tx-sender)
      ERR_NOT_MEMBER
    )
    (asserts! (< stacks-block-height (get expires-at proposal)) ERR_VOTING_CLOSED)
    (asserts!
      (is-none (map-get? member-votes {
        proposal-id: proposal-id,
        voter: tx-sender,
      }))
      ERR_ALREADY_VOTED
    )
    (asserts! (> voting-weight u0) ERR_INSUFFICIENT_STAKE)

    ;; Record vote
    (map-set member-votes {
      proposal-id: proposal-id,
      voter: tx-sender,
    } {
      vote: vote-for,
      weight: voting-weight,
      timestamp: stacks-block-height,
    })

    ;; Update proposal vote counts
    (map-set governance-proposals { proposal-id: proposal-id }
      (merge proposal {
        votes-for: (if vote-for
          (+ (get votes-for proposal) voting-weight)
          (get votes-for proposal)
        ),
        votes-against: (if vote-for
          (get votes-against proposal)
          (+ (get votes-against proposal) voting-weight)
        ),
        total-votes: (+ (get total-votes proposal) voting-weight),
      })
    )
    (ok true)
  )
)

(define-public (execute-proposal (proposal-id uint))
  (let (
      (proposal (unwrap! (map-get? governance-proposals { proposal-id: proposal-id })
        ERR_PROPOSAL_NOT_FOUND
      ))
      (circle (unwrap! (map-get? trust-circles { circle-id: (get circle-id proposal) })
        ERR_CIRCLE_NOT_FOUND
      ))
    )
    ;; Validation
    (asserts! (>= stacks-block-height (get expires-at proposal))
      ERR_VOTING_CLOSED
    )
    (asserts! (not (get executed proposal)) ERR_INVALID_PARAMS)
    (asserts! (> (get votes-for proposal) (get votes-against proposal))
      ERR_INVALID_VOTE
    )

    ;; Check quorum
    (let ((required-votes (/ (* (get total-staked circle) QUORUM_THRESHOLD) u100)))
      (asserts! (>= (get total-votes proposal) required-votes) ERR_INVALID_VOTE)
    )

    ;; Mark as executed
    (map-set governance-proposals { proposal-id: proposal-id }
      (merge proposal { executed: true })
    )

    ;; Execute based on proposal type
    (if (is-eq (get proposal-type proposal) "reward")
      (match (get target proposal)
        target-principal (reward-member (get circle-id proposal) target-principal
          (get amount proposal)
        )
        ERR_INVALID_PARAMS
      )
      (ok true)
    )
  )
)

;; READ-ONLY QUERY FUNCTIONS

(define-read-only (get-circle-info (circle-id uint))
  (map-get? trust-circles { circle-id: circle-id })
)

(define-read-only (get-member-info
    (circle-id uint)
    (member principal)
  )
  (map-get? circle-members {
    circle-id: circle-id,
    member: member,
  })
)

(define-read-only (get-user-reputation (user principal))
  (map-get? user-reputation { user: user })
)

(define-read-only (get-proposal-info (proposal-id uint))
  (map-get? governance-proposals { proposal-id: proposal-id })
)

(define-read-only (get-vote-info
    (proposal-id uint)
    (voter principal)
  )
  (map-get? member-votes {
    proposal-id: proposal-id,
    voter: voter,
  })
)

(define-read-only (get-escrow-balance
    (user principal)
    (circle-id uint)
  )
  (map-get? escrow-balances {
    user: user,
    circle-id: circle-id,
  })
)

(define-read-only (is-member
    (circle-id uint)
    (user principal)
  )
  (is-circle-member circle-id user)
)

(define-read-only (get-next-circle-id)
  (var-get next-circle-id)
)

(define-read-only (get-next-proposal-id)
  (var-get next-proposal-id)
)
