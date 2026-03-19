#!/usr/bin/env python3
"""
Test/Demo: Phase 3 Personalized Scoring
╭─────────────────────────────────────────────────────────╮
│ Demonstrates the HackathonMatcher service usage          │
│ Run: python test_phase3_scoring.py                       │
╰─────────────────────────────────────────────────────────╯
"""
import sys
import logging
from datetime import datetime, timedelta, timezone

# Add services to path for local testing
sys.path.insert(0, '/services/api')

from services.matcher import HackathonMatcher

logging.basicConfig(level=logging.DEBUG)
log = logging.getLogger("test_phase3")


def test_skill_overlap():
    """Test: Skill overlap scoring."""
    print("\n" + "=" * 70)
    print("TEST 1: Skill Overlap Scoring")
    print("=" * 70)
    
    matcher = HackathonMatcher()
    
    test_cases = [
        {
            "name": "High skill overlap (90%)",
            "user_skills": ["Python", "FastAPI", "React", "PostgreSQL"],
            "hackathon_tags": ["Python", "FastAPI", "Database", "Backend"],
        },
        {
            "name": "Medium skill overlap (50%)",
            "user_skills": ["Python", "Web Development", "Data Science"],
            "hackathon_tags": ["Python", "Kubernetes", "DevOps", "Go"],
        },
        {
            "name": "Low skill overlap (20%)",
            "user_skills": ["Visual Design", "Figma", "UX"],
            "hackathon_tags": ["Rust", "WebAssembly", "Smart Contracts", "Ethereum"],
        },
    ]
    
    for case in test_cases:
        score = matcher.compute_skill_overlap_score(
            case["user_skills"],
            case["hackathon_tags"]
        )
        print(f"\n{case['name']}")
        print(f"  User skills: {case['user_skills']}")
        print(f"  Hackathon tags: {case['hackathon_tags']}")
        print(f"  → Overlap score: {score:.1f}/100")


def test_urgency_scoring():
    """Test: Urgency scoring based on deadline."""
    print("\n" + "=" * 70)
    print("TEST 2: Urgency Scoring (Days to Deadline)")
    print("=" * 70)
    
    matcher = HackathonMatcher()
    now = datetime.now(timezone.utc)
    
    test_cases = [
        ("Urgent (3 days)", now + timedelta(days=3)),
        ("High (15 days)", now + timedelta(days=15)),
        ("Medium (60 days)", now + timedelta(days=60)),
        ("Low (150 days)", now + timedelta(days=150)),
    ]
    
    for label, deadline in test_cases:
        score = matcher.compute_urgency_score(deadline.isoformat())
        days_left = (deadline - now).days
        print(f"{label:25} ({days_left:3} days) → {score:6.1f}/100")


def test_value_scoring():
    """Test: Prize value scoring."""
    print("\n" + "=" * 70)
    print("TEST 3: Prize Value Scoring")
    print("=" * 70)
    
    matcher = HackathonMatcher()
    
    test_cases = [
        ("No prize", 0),
        ("Small ($10K)", 10000),
        ("Median ($50K)", 50000),
        ("Large ($100K)", 100000),
        ("Mega ($500K)", 500000),
    ]
    
    for label, prize in test_cases:
        score = matcher.compute_value_score(prize)
        print(f"{label:20} (${prize:7,}) → {score:6.1f}/100")


def test_tech_stack_scoring():
    """Test: Tech stack matching."""
    print("\n" + "=" * 70)
    print("TEST 4: Tech Stack Matching")
    print("=" * 70)
    
    matcher = HackathonMatcher()
    
    test_cases = [
        {
            "name": "Backend Python/Node Developer",
            "preferred": ["Python", "TypeScript", "PostgreSQL", "Redis"],
            "hackathon": ["Python", "FastAPI", "PostgreSQL", "Docker"],
        },
        {
            "name": "Web3 Expert",
            "preferred": ["Solidity", "Ethereum", "Web3.js", "Hardhat"],
            "hackathon": ["Rust", "Substrate", "Polkadot"],
        },
    ]
    
    for case in test_cases:
        score = matcher.compute_tech_stack_score(
            case["preferred"],
            case["hackathon"]
        )
        print(f"\n{case['name']}")
        print(f"  Preferred: {case['preferred']}")
        print(f"  Hackathon: {case['hackathon']}")
        print(f"  → Tech stack score: {score:.1f}/100")


def test_neuroplasticity_scoring():
    """Test: Learning capacity vs. difficulty matching."""
    print("\n" + "=" * 70)
    print("TEST 5: Neuroplasticity/Learning Capacity")
    print("=" * 70)
    
    matcher = HackathonMatcher()
    
    test_cases = [
        ("Beginner learner", 0.3, "beginner"),
        ("Intermediate learner", 0.6, "intermediate"),
        ("Advanced learner", 0.9, "advanced"),
        ("Beginner trying advanced 🚀", 0.3, "advanced"),
        ("Expert in beginner hackathon 😴", 0.95, "beginner"),
    ]
    
    for label, neuro, difficulty in test_cases:
        score = matcher.compute_neuro_score(neuro, difficulty)
        print(f"{label:35} (capacity={neuro:.1f}, difficulty={difficulty:12}) → {score:6.1f}/100")


def test_composite_scoring():
    """Test: Full composite scoring pipeline."""
    print("\n" + "=" * 70)
    print("TEST 6: Composite Personalized Scoring")
    print("=" * 70)
    
    matcher = HackathonMatcher()
    
    # Scenario 1: Perfect match
    print("\n[Scenario 1] Perfect Match (Python dev, urgent AI hackathon)")
    now = datetime.now(timezone.utc)
    deadline_urgent = (now + timedelta(days=5)).isoformat()
    
    results = matcher.match_hackathon(
        user_skills=["Python", "Machine Learning", "TensorFlow", "Data Analysis"],
        user_tech_stack=["Python", "PyTorch", "Jupyter"],
        user_neuroplasticity=0.7,
        hackathon_tags=["AI", "Machine Learning", "Python", "Data Science"],
        hackathon_tech_stack=["Python", "TensorFlow", "FastAPI"],
        hackathon_difficulty="intermediate",
        deadline_str=deadline_urgent,
        prize_pool=100000,
    )
    
    print(f"  Skill overlap:      {results.skill_overlap_score:6.1f}/100 (40% = {results.skill_overlap_score * 0.40:5.1f})")
    print(f"  Urgency:            {results.urgency_score:6.1f}/100 (20% = {results.urgency_score * 0.20:5.1f})")
    print(f"  Prize value:        {results.value_score:6.1f}/100 (15% = {results.value_score * 0.15:5.1f})")
    print(f"  Tech stack match:   {results.tech_stack_score:6.1f}/100 (15% = {results.tech_stack_score * 0.15:5.1f})")
    print(f"  Neuroplasticity:    {results.neuro_score:6.1f}/100 (10% = {results.neuro_score * 0.10:5.1f})")
    print(f"  ───────────────────────────────────────────────────")
    print(f"  ✓ FINAL SCORE:      {results.personalized_score:6.1f}/100")
    print(f"  Reasoning: {results.reasoning}")
    
    # Scenario 2: Mismatched skills
    print("\n[Scenario 2] Skill Mismatch (Web dev trying Blockchain hackathon)")
    deadline_far = (now + timedelta(days=120)).isoformat()
    
    results = matcher.match_hackathon(
        user_skills=["React", "Vue", "GraphQL", "CSS"],
        user_tech_stack=["JavaScript", "TypeScript", "Next.js"],
        user_neuroplasticity=0.5,
        hackathon_tags=["Smart Contracts", "Ethereum", "Solidity", "Web3"],
        hackathon_tech_stack=["Solidity", "Hardhat", "Ethers.js"],
        hackathon_difficulty="advanced",
        deadline_str=deadline_far,
        prize_pool=50000,
    )
    
    print(f"  Skill overlap:      {results.skill_overlap_score:6.1f}/100")
    print(f"  Urgency:            {results.urgency_score:6.1f}/100")
    print(f"  Prize value:        {results.value_score:6.1f}/100")
    print(f"  Tech stack match:   {results.tech_stack_score:6.1f}/100")
    print(f"  Neuroplasticity:    {results.neuro_score:6.1f}/100")
    print(f"  ───────────────────────────────────────────────────")
    print(f"  ⚠ FINAL SCORE:      {results.personalized_score:6.1f}/100")
    print(f"  Reasoning: {results.reasoning}")


def main():
    """Run all tests."""
    print("\n" + "🚀 " * 35)
    print("XIIMALAB PHASE 3: INTELLIGENT SCORING TESTS")
    print("🚀 " * 35)
    
    test_skill_overlap()
    test_urgency_scoring()
    test_value_scoring()
    test_tech_stack_scoring()
    test_neuroplasticity_scoring()
    test_composite_scoring()
    
    print("\n" + "=" * 70)
    print("✅ All Phase 3 scoring tests completed!")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
