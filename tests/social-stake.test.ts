import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

declare const simnet: any;

describe("SocialStake Protocol - Comprehensive Tests", () => {
  const accounts = simnet.getAccounts();
  const deployer = accounts.get("deployer")!;
  const owner = deployer;
  const user1 = accounts.get("wallet_1")!;
  const user2 = accounts.get("wallet_2")!;
  const user3 = accounts.get("wallet_3")!;
  const user4 = accounts.get("wallet_4")!;
  const user5 = accounts.get("wallet_5")!;

  const minCircleStake = 1000000; // 1 STX
  const minMemberStake = 100000; // 0.1 STX
  const maxReputationTransfer = 1000;
  const reputationBonus = 10;
  const votingPeriod = 1440; // blocks

  describe("Trust Circle Creation", () => {
    it("should create a public trust circle with valid parameters", () => {
      const circleName = "Bitcoin Builders DAO";
      const isPublic = true;
      const stakeThreshold = 2000000; // 2 STX

      const result = simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii(circleName),
          Cl.bool(isPublic),
          Cl.uint(stakeThreshold)
        ],
        user1
      );

      expect(result.result).toBeOk(Cl.uint(1));

      const circle = simnet.callReadOnlyFn(
        "social-stake",
        "get-circle-info",
        [Cl.uint(1)],
        deployer
      );

      expect(circle.result).toBeSome(
        Cl.tuple({
          name: Cl.stringAscii(circleName),
          creator: Cl.principal(user1),
          "is-public": Cl.bool(isPublic),
          "stake-threshold": Cl.uint(stakeThreshold),
          "total-staked": Cl.uint(stakeThreshold),
          "member-count": Cl.uint(1),
          "created-at": expect.anything(),
          "reputation-weight": Cl.uint(100)
        })
      );

      // Check creator is automatically a member
      const member = simnet.callReadOnlyFn(
        "social-stake",
        "is-member",
        [Cl.uint(1), Cl.principal(user1)],
        deployer
      );
      expect(member.result).toBe(Cl.bool(true));
    });

    it("should create a private trust circle", () => {
      const circleName = "Elite Hackers Club";
      const isPublic = false;
      const stakeThreshold = 5000000; // 5 STX

      const result = simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii(circleName),
          Cl.bool(isPublic),
          Cl.uint(stakeThreshold)
        ],
        user2
      );

      expect(result.result).toBeOk(Cl.uint(1));

      const circle = simnet.callReadOnlyFn(
        "social-stake",
        "get-circle-info",
        [Cl.uint(1)],
        deployer
      );

      expect(circle.value.data["is-public"]).toBe(Cl.bool(false));
    });

    it("should reject circle creation with stake below minimum", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii("Invalid Circle"),
          Cl.bool(true),
          Cl.uint(minCircleStake - 1)
        ],
        user1
      );

      expect(result.result).toBeErr(Cl.uint(400)); // ERR_INVALID_PARAMS
    });

    it("should reject circle creation with empty name", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii(""),
          Cl.bool(true),
          Cl.uint(minCircleStake)
        ],
        user1
      );

      expect(result.result).toBeErr(Cl.uint(400)); // ERR_INVALID_PARAMS
    });

    it("should reject circle creation with name exceeding 64 chars", () => {
      const longName = "a".repeat(65);
      
      const result = simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii(longName),
          Cl.bool(true),
          Cl.uint(minCircleStake)
        ],
        user1
      );

      expect(result.result).toBeErr(Cl.uint(400)); // ERR_INVALID_PARAMS
    });

    it("should create multiple circles with incrementing IDs", () => {
      // First circle
      simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii("Circle 1"),
          Cl.bool(true),
          Cl.uint(2000000)
        ],
        user1
      );

      // Second circle
      const result2 = simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii("Circle 2"),
          Cl.bool(false),
          Cl.uint(3000000)
        ],
        user2
      );

      expect(result2.result).toBeOk(Cl.uint(2));

      const nextId = simnet.callReadOnlyFn(
        "social-stake",
        "get-next-circle-id",
        [],
        deployer
      );
      expect(nextId.result).toBeUint(3);
    });
  });

  describe("Joining Trust Circles", () => {
    let circleId: number;
    const stakeAmount = 2000000;

    beforeEach(() => {
      const result = simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii("Test Circle"),
          Cl.bool(true),
          Cl.uint(stakeAmount)
        ],
        user1
      );
      circleId = 1;
    });

    it("should allow a user to join a circle with sufficient stake", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(circleId),
          Cl.uint(stakeAmount)
        ],
        user2
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Check STX transfer to escrow
      expect(result.events[0].event).toBe("stx_transfer_event");
      expect(result.events[0].data.amount).toBe(stakeAmount.toString());
      expect(result.events[0].data.sender).toBe(user2);

      // Check member info
      const member = simnet.callReadOnlyFn(
        "social-stake",
        "get-member-info",
        [Cl.uint(circleId), Cl.principal(user2)],
        deployer
      );

      expect(member.result).toBeSome(
        Cl.tuple({
          "stake-amount": Cl.uint(stakeAmount),
          "reputation-score": Cl.uint(0),
          "joined-at": expect.anything(),
          "last-activity": expect.anything(),
          "is-active": Cl.bool(true)
        })
      );

      // Check escrow balance
      const escrow = simnet.callReadOnlyFn(
        "social-stake",
        "get-escrow-balance",
        [Cl.principal(user2), Cl.uint(circleId)],
        deployer
      );

      expect(escrow.result).toBeSome(
        Cl.tuple({
          amount: Cl.uint(stakeAmount)
        })
      );

      // Check circle stats updated
      const circle = simnet.callReadOnlyFn(
        "social-stake",
        "get-circle-info",
        [Cl.uint(circleId)],
        deployer
      );
      expect(circle.value.data["member-count"]).toBeUint(2);
      expect(circle.value.data["total-staked"]).toBeUint(stakeAmount * 2);

      // Check user reputation updated
      const userRep = simnet.callReadOnlyFn(
        "social-stake",
        "get-user-reputation",
        [Cl.principal(user2)],
        deployer
      );
      expect(userRep.value.data["total-reputation"]).toBeUint(reputationBonus);
    });

    it("should reject joining non-existent circle", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(999),
          Cl.uint(stakeAmount)
        ],
        user2
      );

      expect(result.result).toBeErr(Cl.uint(404)); // ERR_CIRCLE_NOT_FOUND
    });

    it("should reject joining with insufficient stake", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(circleId),
          Cl.uint(stakeAmount - 1)
        ],
        user2
      );

      expect(result.result).toBeErr(Cl.uint(402)); // ERR_INSUFFICIENT_STAKE
    });

    it("should reject joining if already a member", () => {
      // Join first time
      simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(circleId),
          Cl.uint(stakeAmount)
        ],
        user2
      );

      // Try to join again
      const result = simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(circleId),
          Cl.uint(stakeAmount)
        ],
        user2
      );

      expect(result.result).toBeErr(Cl.uint(409)); // ERR_ALREADY_MEMBER
    });

    it("should reject joining with insufficient STX balance", () => {
      const poorUser = accounts.get("wallet_9")!;
      
      const result = simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(circleId),
          Cl.uint(stakeAmount)
        ],
        poorUser
      );

      expect(result.result).toBeErr(Cl.uint(405)); // ERR_INSUFFICIENT_BALANCE
    });

    it("should allow multiple users to join same circle", () => {
      // User2 joins
      simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(circleId),
          Cl.uint(stakeAmount)
        ],
        user2
      );

      // User3 joins
      const result3 = simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(circleId),
          Cl.uint(stakeAmount)
        ],
        user3
      );

      expect(result3.result).toBeOk(Cl.bool(true));

      const circle = simnet.callReadOnlyFn(
        "social-stake",
        "get-circle-info",
        [Cl.uint(circleId)],
        deployer
      );
      expect(circle.value.data["member-count"]).toBeUint(3);
      expect(circle.value.data["total-staked"]).toBeUint(stakeAmount * 3);
    });
  });

  describe("Leaving Trust Circles", () => {
    let circleId: number;
    const stakeAmount = 2000000;

    beforeEach(() => {
      const result = simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii("Test Circle"),
          Cl.bool(true),
          Cl.uint(stakeAmount)
        ],
        user1
      );
      circleId = 1;

      // User2 joins
      simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(circleId),
          Cl.uint(stakeAmount)
        ],
        user2
      );
    });

    it("should allow a member to leave a circle and get stake back", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "leave-trust-circle",
        [Cl.uint(circleId)],
        user2
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Check STX transfer back from escrow
      expect(result.events[0].event).toBe("stx_transfer_event");
      expect(result.events[0].data.amount).toBe(stakeAmount.toString());
      expect(result.events[0].data.recipient).toBe(user2);

      // Check member removed
      const member = simnet.callReadOnlyFn(
        "social-stake",
        "is-member",
        [Cl.uint(circleId), Cl.principal(user2)],
        deployer
      );
      expect(member.result).toBe(Cl.bool(false));

      // Check circle stats updated
      const circle = simnet.callReadOnlyFn(
        "social-stake",
        "get-circle-info",
        [Cl.uint(circleId)],
        deployer
      );
      expect(circle.value.data["member-count"]).toBeUint(1);
      expect(circle.value.data["total-staked"]).toBeUint(stakeAmount);
    });

    it("should reject leaving a circle user is not in", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "leave-trust-circle",
        [Cl.uint(circleId)],
        user3
      );

      expect(result.result).toBeErr(Cl.uint(403)); // ERR_NOT_MEMBER
    });

    it("should reject leaving non-existent circle", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "leave-trust-circle",
        [Cl.uint(999)],
        user2
      );

      expect(result.result).toBeErr(Cl.uint(404)); // ERR_CIRCLE_NOT_FOUND
    });
  });

  describe("Reputation System", () => {
    let circleId: number;
    const stakeAmount = 2000000;

    beforeEach(() => {
      const result = simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii("Test Circle"),
          Cl.bool(true),
          Cl.uint(stakeAmount)
        ],
        user1
      );
      circleId = 1;

      // User2 joins
      simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(circleId),
          Cl.uint(stakeAmount)
        ],
        user2
      );
    });

    it("should allow a member to endorse another member", () => {
      const endorseAmount = 100;

      const result = simnet.callPublicFn(
        "social-stake",
        "endorse-member",
        [
          Cl.uint(circleId),
          Cl.principal(user2),
          Cl.uint(endorseAmount)
        ],
        user1
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Check user1's reputation decreased
      const member1 = simnet.callReadOnlyFn(
        "social-stake",
        "get-member-info",
        [Cl.uint(circleId), Cl.principal(user1)],
        deployer
      );
      expect(member1.value.data["reputation-score"]).toBeUint(endorseAmount); // Started at 0

      // Check user2's reputation increased
      const member2 = simnet.callReadOnlyFn(
        "social-stake",
        "get-member-info",
        [Cl.uint(circleId), Cl.principal(user2)],
        deployer
      );
      expect(member2.value.data["reputation-score"]).toBeUint(endorseAmount);

      // Check global reputation updated
      const user1Rep = simnet.callReadOnlyFn(
        "social-stake",
        "get-user-reputation",
        [Cl.principal(user1)],
        deployer
      );
      const user2Rep = simnet.callReadOnlyFn(
        "social-stake",
        "get-user-reputation",
        [Cl.principal(user2)],
        deployer
      );
      expect(user1Rep.value.data["total-reputation"]).toBeUint(reputationBonus);
      expect(user2Rep.value.data["total-reputation"]).toBeUint(reputationBonus + endorseAmount);
    });

    it("should reject endorsing with amount above max", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "endorse-member",
        [
          Cl.uint(circleId),
          Cl.principal(user2),
          Cl.uint(maxReputationTransfer + 1)
        ],
        user1
      );

      expect(result.result).toBeErr(Cl.uint(400)); // ERR_INVALID_PARAMS
    });

    it("should reject self-endorsement", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "endorse-member",
        [
          Cl.uint(circleId),
          Cl.principal(user1),
          Cl.uint(100)
        ],
        user1
      );

      expect(result.result).toBeErr(Cl.uint(400)); // ERR_INVALID_PARAMS
    });

    it("should reject endorsing with insufficient reputation", () => {
      // User2 has 0 reputation, can't endorse
      const result = simnet.callPublicFn(
        "social-stake",
        "endorse-member",
        [
          Cl.uint(circleId),
          Cl.principal(user1),
          Cl.uint(100)
        ],
        user2
      );

      expect(result.result).toBeErr(Cl.uint(405)); // ERR_INSUFFICIENT_BALANCE
    });

    it("should allow rewarding a member", () => {
      const rewardAmount = 200;

      const result = simnet.callPublicFn(
        "social-stake",
        "reward-member",
        [
          Cl.uint(circleId),
          Cl.principal(user2),
          Cl.uint(rewardAmount)
        ],
        user1
      );

      expect(result.result).toBeOk(Cl.bool(true));

      const member2 = simnet.callReadOnlyFn(
        "social-stake",
        "get-member-info",
        [Cl.uint(circleId), Cl.principal(user2)],
        deployer
      );
      expect(member2.value.data["reputation-score"]).toBeUint(rewardAmount);
    });
  });

  describe("Governance Proposals", () => {
    let circleId: number;
    const stakeAmount = 2000000;

    beforeEach(() => {
      const result = simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii("Test Circle"),
          Cl.bool(true),
          Cl.uint(stakeAmount)
        ],
        user1
      );
      circleId = 1;

      // User2 joins
      simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(circleId),
          Cl.uint(stakeAmount)
        ],
        user2
      );
    });

    it("should create a reward proposal", () => {
      const proposalType = "reward";
      const target = user2;
      const amount = 500;
      const description = "Reward for excellent contribution";

      const result = simnet.callPublicFn(
        "social-stake",
        "create-proposal",
        [
          Cl.uint(circleId),
          Cl.stringAscii(proposalType),
          Cl.some(Cl.principal(target)),
          Cl.uint(amount),
          Cl.stringAscii(description)
        ],
        user1
      );

      expect(result.result).toBeOk(Cl.uint(1));

      const proposal = simnet.callReadOnlyFn(
        "social-stake",
        "get-proposal-info",
        [Cl.uint(1)],
        deployer
      );

      expect(proposal.result).toBeSome(
        Cl.tuple({
          "circle-id": Cl.uint(circleId),
          proposer: Cl.principal(user1),
          "proposal-type": Cl.stringAscii(proposalType),
          target: Cl.some(Cl.principal(target)),
          amount: Cl.uint(amount),
          description: Cl.stringAscii(description),
          "votes-for": Cl.uint(0),
          "votes-against": Cl.uint(0),
          "total-votes": Cl.uint(0),
          "created-at": expect.anything(),
          "expires-at": expect.anything(),
          executed: Cl.bool(false)
        })
      );
    });

    it("should create a slash proposal", () => {
      const proposalType = "slash";
      const target = user2;
      const amount = 300;

      const result = simnet.callPublicFn(
        "social-stake",
        "create-proposal",
        [
          Cl.uint(circleId),
          Cl.stringAscii(proposalType),
          Cl.some(Cl.principal(target)),
          Cl.uint(amount),
          Cl.stringAscii("Penalty for rule violation")
        ],
        user1
      );

      expect(result.result).toBeOk(Cl.uint(1));
    });

    it("should create a kick proposal", () => {
      const proposalType = "kick";
      const target = user2;
      const amount = 0;

      const result = simnet.callPublicFn(
        "social-stake",
        "create-proposal",
        [
          Cl.uint(circleId),
          Cl.stringAscii(proposalType),
          Cl.some(Cl.principal(target)),
          Cl.uint(amount),
          Cl.stringAscii("Remove member")
        ],
        user1
      );

      expect(result.result).toBeOk(Cl.uint(1));
    });

    it("should reject proposal creation by non-member", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "create-proposal",
        [
          Cl.uint(circleId),
          Cl.stringAscii("reward"),
          Cl.some(Cl.principal(user2)),
          Cl.uint(500),
          Cl.stringAscii("Test")
        ],
        user3
      );

      expect(result.result).toBeErr(Cl.uint(403)); // ERR_NOT_MEMBER
    });

    it("should reject proposal with invalid type", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "create-proposal",
        [
          Cl.uint(circleId),
          Cl.stringAscii("invalid"),
          Cl.some(Cl.principal(user2)),
          Cl.uint(500),
          Cl.stringAscii("Test")
        ],
        user1
      );

      expect(result.result).toBeErr(Cl.uint(400)); // ERR_INVALID_PARAMS
    });

    it("should reject proposal with amount above max", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "create-proposal",
        [
          Cl.uint(circleId),
          Cl.stringAscii("reward"),
          Cl.some(Cl.principal(user2)),
          Cl.uint(MAX_PROPOSAL_AMOUNT + 1),
          Cl.stringAscii("Test")
        ],
        user1
      );

      expect(result.result).toBeErr(Cl.uint(400)); // ERR_INVALID_PARAMS
    });
  });

  describe("Voting on Proposals", () => {
    let circleId: number;
    let proposalId: number;
    const stakeAmount = 2000000;

    beforeEach(() => {
      // Create circle with multiple members
      simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii("Test Circle"),
          Cl.bool(true),
          Cl.uint(stakeAmount)
        ],
        user1
      );
      circleId = 1;

      simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(circleId),
          Cl.uint(stakeAmount)
        ],
        user2
      );

      simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(circleId),
          Cl.uint(stakeAmount)
        ],
        user3
      );

      // Create proposal
      const result = simnet.callPublicFn(
        "social-stake",
        "create-proposal",
        [
          Cl.uint(circleId),
          Cl.stringAscii("reward"),
          Cl.some(Cl.principal(user2)),
          Cl.uint(500),
          Cl.stringAscii("Reward user2")
        ],
        user1
      );
      proposalId = 1;
    });

    it("should allow members to vote on proposals", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "vote-on-proposal",
        [
          Cl.uint(proposalId),
          Cl.bool(true) // vote for
        ],
        user1
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Check vote recorded
      const vote = simnet.callReadOnlyFn(
        "social-stake",
        "get-vote-info",
        [Cl.uint(proposalId), Cl.principal(user1)],
        deployer
      );

      expect(vote.result).toBeSome(
        Cl.tuple({
          vote: Cl.bool(true),
          weight: Cl.uint(stakeAmount), // stake + reputation
          timestamp: expect.anything()
        })
      );

      // Check proposal updated
      const proposal = simnet.callReadOnlyFn(
        "social-stake",
        "get-proposal-info",
        [Cl.uint(proposalId)],
        deployer
      );
      expect(proposal.value.data["votes-for"]).toBeUint(stakeAmount);
      expect(proposal.value.data["total-votes"]).toBeUint(stakeAmount);
    });

    it("should calculate voting weight correctly (stake + reputation)", () => {
      // Add some reputation to user1
      simnet.callPublicFn(
        "social-stake",
        "reward-member",
        [
          Cl.uint(circleId),
          Cl.principal(user1),
          Cl.uint(500)
        ],
        user2
      );

      const result = simnet.callPublicFn(
        "social-stake",
        "vote-on-proposal",
        [
          Cl.uint(proposalId),
          Cl.bool(true)
        ],
        user1
      );

      expect(result.result).toBeOk(Cl.bool(true));

      const vote = simnet.callReadOnlyFn(
        "social-stake",
        "get-vote-info",
        [Cl.uint(proposalId), Cl.principal(user1)],
        deployer
      );

      // Weight should be stake (2,000,000) + reputation (500) = 2,000,500
      expect(vote.value.data.weight).toBeUint(2000000 + 500);
    });

    it("should prevent double voting", () => {
      // First vote
      simnet.callPublicFn(
        "social-stake",
        "vote-on-proposal",
        [
          Cl.uint(proposalId),
          Cl.bool(true)
        ],
        user1
      );

      // Second vote attempt
      const result = simnet.callPublicFn(
        "social-stake",
        "vote-on-proposal",
        [
          Cl.uint(proposalId),
          Cl.bool(false)
        ],
        user1
      );

      expect(result.result).toBeErr(Cl.uint(408)); // ERR_ALREADY_VOTED
    });

    it("should prevent non-members from voting", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "vote-on-proposal",
        [
          Cl.uint(proposalId),
          Cl.bool(true)
        ],
        user4
      );

      expect(result.result).toBeErr(Cl.uint(403)); // ERR_NOT_MEMBER
    });

    it("should prevent voting after proposal expires", () => {
      // Advance blocks past voting period
      simnet.mineEmptyBlocks(votingPeriod + 10);

      const result = simnet.callPublicFn(
        "social-stake",
        "vote-on-proposal",
        [
          Cl.uint(proposalId),
          Cl.bool(true)
        ],
        user1
      );

      expect(result.result).toBeErr(Cl.uint(407)); // ERR_VOTING_CLOSED
    });
  });

  describe("Proposal Execution", () => {
    let circleId: number;
    let proposalId: number;
    const stakeAmount = 2000000;

    beforeEach(() => {
      // Create circle with multiple members
      simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii("Test Circle"),
          Cl.bool(true),
          Cl.uint(stakeAmount)
        ],
        user1
      );
      circleId = 1;

      simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(circleId),
          Cl.uint(stakeAmount)
        ],
        user2
      );

      simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(circleId),
          Cl.uint(stakeAmount)
        ],
        user3
      );

      // Create proposal
      const result = simnet.callPublicFn(
        "social-stake",
        "create-proposal",
        [
          Cl.uint(circleId),
          Cl.stringAscii("reward"),
          Cl.some(Cl.principal(user2)),
          Cl.uint(500),
          Cl.stringAscii("Reward user2")
        ],
        user1
      );
      proposalId = 1;

      // All members vote in favor
      simnet.callPublicFn(
        "social-stake",
        "vote-on-proposal",
        [Cl.uint(proposalId), Cl.bool(true)],
        user1
      );

      simnet.callPublicFn(
        "social-stake",
        "vote-on-proposal",
        [Cl.uint(proposalId), Cl.bool(true)],
        user2
      );

      simnet.callPublicFn(
        "social-stake",
        "vote-on-proposal",
        [Cl.uint(proposalId), Cl.bool(true)],
        user3
      );

      // Advance past voting period
      simnet.mineEmptyBlocks(votingPeriod + 10);
    });

    it("should execute approved proposal", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "execute-proposal",
        [Cl.uint(proposalId)],
        user1
      );

      expect(result.result).toBeOk(Cl.bool(true));

      // Check proposal marked as executed
      const proposal = simnet.callReadOnlyFn(
        "social-stake",
        "get-proposal-info",
        [Cl.uint(proposalId)],
        deployer
      );
      expect(proposal.value.data.executed).toBe(Cl.bool(true));

      // Check target received reputation
      const member2 = simnet.callReadOnlyFn(
        "social-stake",
        "get-member-info",
        [Cl.uint(circleId), Cl.principal(user2)],
        deployer
      );
      expect(member2.value.data["reputation-score"]).toBeUint(500);
    });

    it("should prevent executing proposal that didn't pass", () => {
      // Create a new proposal that will fail
      const result2 = simnet.callPublicFn(
        "social-stake",
        "create-proposal",
        [
          Cl.uint(circleId),
          Cl.stringAscii("kick"),
          Cl.some(Cl.principal(user2)),
          Cl.uint(0),
          Cl.stringAscii("Kick user2")
        ],
        user1
      );
      const failingProposalId = 2;

      // Only user1 votes for, others abstain
      simnet.callPublicFn(
        "social-stake",
        "vote-on-proposal",
        [Cl.uint(failingProposalId), Cl.bool(true)],
        user1
      );

      simnet.mineEmptyBlocks(votingPeriod + 10);

      const result = simnet.callPublicFn(
        "social-stake",
        "execute-proposal",
        [Cl.uint(failingProposalId)],
        user1
      );

      expect(result.result).toBeErr(Cl.uint(410)); // ERR_INVALID_VOTE
    });

    it("should prevent executing proposal twice", () => {
      // First execution
      simnet.callPublicFn(
        "social-stake",
        "execute-proposal",
        [Cl.uint(proposalId)],
        user1
      );

      // Second execution attempt
      const result = simnet.callPublicFn(
        "social-stake",
        "execute-proposal",
        [Cl.uint(proposalId)],
        user1
      );

      expect(result.result).toBeErr(Cl.uint(400)); // ERR_INVALID_PARAMS
    });
  });

  describe("Read-Only Functions - Edge Cases", () => {
    it("should return none for non-existent circle", () => {
      const result = simnet.callReadOnlyFn(
        "social-stake",
        "get-circle-info",
        [Cl.uint(999)],
        deployer
      );
      expect(result.result).toBeNone();
    });

    it("should return none for non-existent member", () => {
      const result = simnet.callReadOnlyFn(
        "social-stake",
        "get-member-info",
        [Cl.uint(1), Cl.principal(user1)],
        deployer
      );
      expect(result.result).toBeNone();
    });

    it("should return default for non-existent user reputation", () => {
      const result = simnet.callReadOnlyFn(
        "social-stake",
        "get-user-reputation",
        [Cl.principal(user1)],
        deployer
      );

      expect(result.result).toEqual(
        Cl.tuple({
          "total-reputation": Cl.uint(0),
          "circles-joined": Cl.uint(0),
          "total-staked": Cl.uint(0),
          "last-updated": Cl.uint(0)
        })
      );
    });

    it("should return false for is-member check on non-member", () => {
      const result = simnet.callReadOnlyFn(
        "social-stake",
        "is-member",
        [Cl.uint(1), Cl.principal(user1)],
        deployer
      );
      expect(result.result).toBe(Cl.bool(false));
    });

    it("should return none for non-existent escrow balance", () => {
      const result = simnet.callReadOnlyFn(
        "social-stake",
        "get-escrow-balance",
        [Cl.principal(user1), Cl.uint(1)],
        deployer
      );
      expect(result.result).toBeNone();
    });
  });

  describe("Error Conditions", () => {
    it("should handle ERR_UNAUTHORIZED (401)", () => {
      // Test would need a function that checks authorization
    });

    it("should handle ERR_INVALID_PARAMS (400)", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii(""),
          Cl.bool(true),
          Cl.uint(minCircleStake)
        ],
        user1
      );
      expect(result.result).toBeErr(Cl.uint(400));
    });

    it("should handle ERR_CIRCLE_NOT_FOUND (404)", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(999),
          Cl.uint(1000000)
        ],
        user1
      );
      expect(result.result).toBeErr(Cl.uint(404));
    });

    it("should handle ERR_ALREADY_MEMBER (409)", () => {
      // Create circle (user1 is auto-member)
      simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii("Test"),
          Cl.bool(true),
          Cl.uint(2000000)
        ],
        user1
      );

      // Try to join again
      const result = simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(1),
          Cl.uint(2000000)
        ],
        user1
      );
      expect(result.result).toBeErr(Cl.uint(409));
    });

    it("should handle ERR_NOT_MEMBER (403)", () => {
      const result = simnet.callPublicFn(
        "social-stake",
        "leave-trust-circle",
        [Cl.uint(1)],
        user1
      );
      expect(result.result).toBeErr(Cl.uint(403));
    });

    it("should handle ERR_INSUFFICIENT_STAKE (402)", () => {
      simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii("Test"),
          Cl.bool(true),
          Cl.uint(2000000)
        ],
        user1
      );

      const result = simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [
          Cl.uint(1),
          Cl.uint(1000000) // Below threshold
        ],
        user2
      );
      expect(result.result).toBeErr(Cl.uint(402));
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle complete circle lifecycle with governance", () => {
      // 1. User1 creates circle
      const createResult = simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii("Bitcoin Collective"),
          Cl.bool(true),
          Cl.uint(2000000)
        ],
        user1
      );
      const circleId = 1;

      // 2. Multiple users join
      simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [Cl.uint(circleId), Cl.uint(2000000)],
        user2
      );

      simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [Cl.uint(circleId), Cl.uint(2000000)],
        user3
      );

      simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [Cl.uint(circleId), Cl.uint(2000000)],
        user4
      );

      // 3. Members endorse each other
      simnet.callPublicFn(
        "social-stake",
        "endorse-member",
        [Cl.uint(circleId), Cl.principal(user2), Cl.uint(100)],
        user1
      );

      simnet.callPublicFn(
        "social-stake",
        "endorse-member",
        [Cl.uint(circleId), Cl.principal(user3), Cl.uint(200)],
        user2
      );

      // 4. Create proposal to reward user4
      const proposalResult = simnet.callPublicFn(
        "social-stake",
        "create-proposal",
        [
          Cl.uint(circleId),
          Cl.stringAscii("reward"),
          Cl.some(Cl.principal(user4)),
          Cl.uint(300),
          Cl.stringAscii("Reward for contributions")
        ],
        user1
      );
      const proposalId = 1;

      // 5. Members vote
      simnet.callPublicFn(
        "social-stake",
        "vote-on-proposal",
        [Cl.uint(proposalId), Cl.bool(true)],
        user1
      );

      simnet.callPublicFn(
        "social-stake",
        "vote-on-proposal",
        [Cl.uint(proposalId), Cl.bool(true)],
        user2
      );

      simnet.callPublicFn(
        "social-stake",
        "vote-on-proposal",
        [Cl.uint(proposalId), Cl.bool(true)],
        user3
      );

      // 6. Advance time and execute
      simnet.mineEmptyBlocks(votingPeriod + 10);

      simnet.callPublicFn(
        "social-stake",
        "execute-proposal",
        [Cl.uint(proposalId)],
        user1
      );

      // 7. Verify final state
      const member4 = simnet.callReadOnlyFn(
        "social-stake",
        "get-member-info",
        [Cl.uint(circleId), Cl.principal(user4)],
        deployer
      );
      expect(member4.value.data["reputation-score"]).toBeUint(300);

      const user4Rep = simnet.callReadOnlyFn(
        "social-stake",
        "get-user-reputation",
        [Cl.principal(user4)],
        deployer
      );
      expect(user4Rep.value.data["total-reputation"]).toBeUint(reputationBonus + 300);
    });

    it("should handle multiple circles with overlapping members", () => {
      // Create circle 1
      simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii("Circle A"),
          Cl.bool(true),
          Cl.uint(2000000)
        ],
        user1
      );

      // Create circle 2
      simnet.callPublicFn(
        "social-stake",
        "create-trust-circle",
        [
          Cl.stringAscii("Circle B"),
          Cl.bool(true),
          Cl.uint(3000000)
        ],
        user2
      );

      // User3 joins both circles
      simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [Cl.uint(1), Cl.uint(2000000)],
        user3
      );

      simnet.callPublicFn(
        "social-stake",
        "join-trust-circle",
        [Cl.uint(2), Cl.uint(3000000)],
        user3
      );

      // User3 builds reputation in both
      simnet.callPublicFn(
        "social-stake",
        "reward-member",
        [Cl.uint(1), Cl.principal(user3), Cl.uint(100)],
        user1
      );

      simnet.callPublicFn(
        "social-stake",
        "reward-member",
        [Cl.uint(2), Cl.principal(user3), Cl.uint(200)],
        user2
      );

      // Check global reputation accumulates
      const user3Rep = simnet.callReadOnlyFn(
        "social-stake",
        "get-user-reputation",
        [Cl.principal(user3)],
        deployer
      );
      expect(user3Rep.value.data["total-reputation"]).toBeUint(reputationBonus * 2 + 300);
      expect(user3Rep.value.data["circles-joined"]).toBeUint(2);
      expect(user3Rep.value.data["total-staked"]).toBeUint(5000000);
    });
  });
});
