# SocialStake Protocol

**Trust-Based Social Finance on Bitcoin Layer 2**

[![Stacks](https://img.shields.io/badge/Built%20on-Stacks-5546FF)](https://www.stacks.co/)
[![Clarity](https://img.shields.io/badge/Smart%20Contract-Clarity-blue)](https://clarity-lang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Overview

SocialStake revolutionizes social interaction by creating economically-backed trust networks on Bitcoin's Layer 2. Members stake STX tokens to join exclusive communities, earning reputation through positive interactions and governing collective decisions through weighted voting mechanisms.

Built on the Stacks blockchain for Bitcoin-grade security, SocialStake introduces a novel social finance paradigm where trust becomes quantifiable and reputation becomes valuable. The protocol features stake-backed membership, reputation mining through social interactions, decentralized governance with economic incentives, automated escrow management, and transferable social capital.

## Key Features

### 🛡️ Stake-Backed Membership

- **Economic Commitment**: Members must stake STX tokens to join circles
- **Skin in the Game**: Financial incentives align with social behavior
- **Automated Escrow**: Smart contract manages all staked funds securely

### 🏆 Reputation System

- **Reputation Mining**: Earn reputation through positive social interactions
- **Transferable Social Capital**: Endorse other members to transfer reputation
- **Global Reputation Tracking**: Aggregate reputation across all circles

### 🗳️ Decentralized Governance

- **Weighted Voting**: Voting power based on stake + reputation
- **Proposal System**: Create and vote on governance proposals
- **Automated Execution**: Smart contract executes approved proposals

### 🎯 Trust Circles

- **Private/Public Circles**: Choose visibility and access controls
- **Custom Stake Thresholds**: Set minimum stakes for your community
- **Member Management**: Tools for circle creators and members

## Architecture

### Core Components

```
SocialStake Protocol
├── Trust Circles (Communities)
├── Stake Management (Escrow)
├── Reputation System (Social Capital)
├── Governance (Proposals & Voting)
└── Member Registry (Access Control)
```

### Smart Contract Structure

- **Data Maps**: Efficient storage for circles, members, proposals, and votes
- **Helper Functions**: Validation and utility functions for security
- **Public Functions**: Core protocol operations
- **Read-Only Functions**: Query interface for dApps and integrations

## Getting Started

### Prerequisites

- [Clarinet](https://github.com/hirosystems/clarinet) - Stacks smart contract development environment
- [Stacks Wallet](https://www.hiro.so/wallet) - For interacting with the protocol
- STX tokens for staking

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/aniefioke/social-stake.git
cd social-stake
```

2. **Install dependencies**

```bash
npm install
```

3. **Run contract checks**

```bash
clarinet check
```

4. **Run tests**

```bash
npm test
```

## Usage

### Creating a Trust Circle

```clarity
;; Create a new trust circle
(contract-call? .social-stake create-trust-circle 
  "My Community"     ;; Circle name
  true              ;; Public visibility
  u1000000)         ;; 1 STX minimum stake
```

### Joining a Circle

```clarity
;; Join an existing trust circle
(contract-call? .social-stake join-trust-circle
  u1               ;; Circle ID
  u1000000)        ;; Stake amount (must meet minimum)
```

### Endorsing Members

```clarity
;; Endorse another member (transfer reputation)
(contract-call? .social-stake endorse-member
  u1               ;; Circle ID
  'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM  ;; Target member
  u50)             ;; Reputation amount
```

### Creating Proposals

```clarity
;; Create a governance proposal
(contract-call? .social-stake create-proposal
  u1               ;; Circle ID
  "reward"         ;; Proposal type
  (some 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)  ;; Target
  u100             ;; Amount
  "Reward active contributor")  ;; Description
```

## Economic Model

### Stake Requirements

- **Minimum Circle Stake**: 1 STX (1,000,000 µSTX)
- **Minimum Member Stake**: 0.1 STX (100,000 µSTX)
- **Protocol Fee**: 0.5%

### Reputation Economics

- **Joining Bonus**: 10 reputation points for new members
- **Maximum Transfer**: 1,000 reputation per transaction
- **Reputation Weight**: 100x multiplier for governance calculations

### Governance Parameters

- **Voting Period**: 24 hours (1,440 blocks)
- **Quorum Threshold**: 60% participation required
- **Maximum Proposal**: 10 STX limit

## API Reference

### Public Functions

#### Circle Management

- `create-trust-circle(name, is-public, stake-threshold)` - Create new circle
- `join-trust-circle(circle-id, stake-amount)` - Join existing circle
- `leave-trust-circle(circle-id)` - Exit circle and reclaim stake

#### Reputation System

- `endorse-member(circle-id, target, amount)` - Transfer reputation to member
- `reward-member(circle-id, target, amount)` - Award reputation (authorized)

#### Governance

- `create-proposal(circle-id, type, target, amount, description)` - Submit proposal
- `vote-on-proposal(proposal-id, vote-for)` - Cast weighted vote
- `execute-proposal(proposal-id)` - Execute approved proposal

### Read-Only Functions

#### Query Functions

- `get-circle-info(circle-id)` - Circle details and statistics
- `get-member-info(circle-id, member)` - Member stake and reputation
- `get-user-reputation(user)` - Global user reputation
- `get-proposal-info(proposal-id)` - Proposal details and vote counts
- `is-member(circle-id, user)` - Check membership status

## Error Codes

| Code | Error | Description |
|------|-------|-------------|
| 400 | ERR_INVALID_PARAMS | Invalid input parameters |
| 401 | ERR_UNAUTHORIZED | Insufficient permissions |
| 402 | ERR_INSUFFICIENT_STAKE | Stake amount too low |
| 403 | ERR_NOT_MEMBER | User not a circle member |
| 404 | ERR_CIRCLE_NOT_FOUND | Circle does not exist |
| 405 | ERR_INSUFFICIENT_BALANCE | Insufficient STX balance |
| 406 | ERR_PROPOSAL_NOT_FOUND | Proposal does not exist |
| 407 | ERR_VOTING_CLOSED | Voting period ended |
| 408 | ERR_ALREADY_VOTED | User already voted |
| 409 | ERR_ALREADY_MEMBER | User already in circle |
| 410 | ERR_INVALID_VOTE | Invalid vote parameters |

## Testing

The protocol includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run contract checks
clarinet check

# Generate test coverage report
npm run test:coverage
```

### Test Categories

- **Unit Tests**: Individual function testing
- **Integration Tests**: Multi-function workflows
- **Edge Case Tests**: Boundary condition validation
- **Security Tests**: Attack vector prevention

## Security Considerations

### Audit Status

- [ ] External security audit pending
- [x] Internal code review completed
- [x] Automated testing implemented

### Security Features

- **Escrow Protection**: All stakes held in contract escrow
- **Access Control**: Membership validation on all functions
- **Parameter Validation**: Input sanitization and bounds checking
- **Reentrancy Protection**: Safe state updates and transfers

### Known Limitations

- Governance proposals limited to specific types
- Reputation transfers capped for safety
- No slashing mechanism implemented yet

## Roadmap

### Phase 1: Core Protocol ✅

- [x] Basic circle creation and membership
- [x] Stake management and escrow
- [x] Reputation system foundation
- [x] Governance framework

### Phase 2: Advanced Features 🚧

- [ ] Slashing mechanisms for bad actors
- [ ] Advanced proposal types
- [ ] Reputation decay models
- [ ] Cross-circle interactions

### Phase 3: Ecosystem 🔮

- [ ] Frontend application
- [ ] Mobile wallet integration
- [ ] Analytics dashboard
- [ ] Third-party integrations

## Contributing

We welcome contributions from the community! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Standards

- Follow Clarity best practices
- Include comprehensive tests
- Document all public functions
- Use descriptive variable names

## Community

- **Discord**: [Join our community](https://discord.gg/socialstake)
- **Twitter**: [@SocialStake](https://twitter.com/socialstake)
- **Blog**: [Latest updates](https://blog.socialstake.com)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built on [Stacks](https://www.stacks.co/) blockchain
- Inspired by decentralized governance research
- Community feedback and contributions
