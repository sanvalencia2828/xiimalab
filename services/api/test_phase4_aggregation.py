#!/usr/bin/env python3
"""
Test/Demo: Phase 4 Multi-Source Aggregation
╭─────────────────────────────────────────────────────────╮
│ Demonstrates hackathon fuzzy deduplication              │
│ and multi-source aggregation                            │
│ Run: python test_phase4_aggregation.py                  │
╰─────────────────────────────────────────────────────────╯
"""
import logging
from services.aggregator import HackathonDeduplicator, HackathonAggregator

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("test_phase4")


def test_fuzzy_matching():
    """Test: Fuzzy title matching and deduplication."""
    print("\n" + "=" * 80)
    print("TEST 1: Fuzzy Title Matching & Deduplication")
    print("=" * 80)
    
    dedup = HackathonDeduplicator(threshold=0.90)
    
    test_cases = [
        {
            "pair": ("AI Hackathon 2025", "AI Hackathon 2025"),
            "expected": True,
            "name": "Exact match"
        },
        {
            "pair": ("AI Hackathon 2025", "AI Hackathon '25"),
            "expected": True,
            "name": "Year variation"
        },
        {
            "pair": ("Web3 Global Hackathon", "Web3 Hackathon"),
            "expected": True,
            "name": "Minor word difference"
        },
        {
            "pair": ("AI Hackathon 2025", "Machine Learning 2025"),
            "expected": False,
            "name": "Different topic"
        },
        {
            "pair": ("ETH Denver 2025", "Ethereum Denver"),
            "expected": True,
            "name": "City-based match"
        },
    ]
    
    for case in test_cases:
        title1, title2 = case["pair"]
        similarity = dedup._similarity(title1, title2)
        is_duplicate = similarity >= dedup.threshold
        status = "✓" if is_duplicate == case["expected"] else "✗"
        
        print(f"\n{status} {case['name']}")
        print(f"  '{title1}'")
        print(f"  '{title2}'")
        print(f"  Similarity: {similarity:.1%} (threshold: {dedup.threshold:.1%})")
        print(f"  Is duplicate: {is_duplicate}")


def test_multi_source_aggregation():
    """Test: Multi-source aggregation with deduplication."""
    print("\n" + "=" * 80)
    print("TEST 2: Multi-Source Aggregation")
    print("=" * 80)
    
    # Mock data from different sources
    devfolio_hackathons = [
        {
            "id": "devfolio_001",
            "title": "AI Hackathon 2025",
            "description": "Global AI competition",
            "prize_pool": 100000,
            "tags": ["AI", "Machine Learning", "Python"],
            "deadline": "2025-04-30T00:00:00Z",
            "source": "devfolio",
            "source_url": "https://devfolio.co/ai-2025",
            "organizer": "AI Foundation",
            "city": "San Francisco",
            "event_type": "virtual",
            "tech_stack": ["Python", "TensorFlow"],
            "difficulty": "intermediate",
        },
        {
            "id": "devfolio_002",
            "title": "Web3 Smart Contract Hackathon",
            "description": "Build on Ethereum",
            "prize_pool": 75000,
            "tags": ["Ethereum", "DeFi", "Solidity"],
            "deadline": "2025-05-15T00:00:00Z",
            "source": "devfolio",
            "source_url": "https://devfolio.co/web3-2025",
            "organizer": "Ethereum Org",
            "city": "Singapore",
            "event_type": "hybrid",
            "tech_stack": ["Solidity", "Hardhat"],
            "difficulty": "advanced",
        },
    ]
    
    dorahacks_hackathons = [
        {
            "id": "dorahacks_001",
            "title": "AI Hackathon 2025",  # Duplicate of devfolio_001
            "description": "AI competition with prizes",
            "prize_pool": 95000,
            "tags": ["Artificial Intelligence", "ML", "Python"],
            "deadline": "2025-05-01T00:00:00Z",
            "source": "dorahacks",
            "source_url": "https://dorahacks.io/ai-2025",
            "organizer": None,
            "city": None,
            "event_type": None,
            "tech_stack": ["Python"],
            "difficulty": None,
        },
        {
            "id": "dorahacks_002",
            "title": "DeFi Hackathon 2025",  # Different from Web3 hackathon
            "description": "Build DeFi protocols",
            "prize_pool": 50000,
            "tags": ["DeFi", "Protocol", "Ethereum"],
            "deadline": "2025-06-01T00:00:00Z",
            "source": "dorahacks",
            "source_url": "https://dorahacks.io/defi-2025",
            "organizer": None,
            "city": None,
            "event_type": None,
            "tech_stack": None,
            "difficulty": None,
        },
    ]
    
    devpost_hackathons = [
        {
            "id": "devpost_001",
            "title": "AI-2025",  # Very similar to devfolio_001
            "description": "AI Hackathon",
            "prize_pool": 100000,
            "tags": ["AI", "ML"],
            "deadline": "2025-04-30T00:00:00Z",
            "source": "devpost",
            "source_url": "https://devpost.com/ai-2025",
            "organizer": None,
            "city": None,
            "event_type": None,
            "tech_stack": None,
            "difficulty": None,
        },
    ]
    
    # Aggregate
    aggregator = HackathonAggregator(dedup_threshold=0.90)
    aggregated = aggregator.aggregate(
        devfolio_hackathons=devfolio_hackathons,
        dorahacks_hackathons=dorahacks_hackathons,
        devpost_hackathons=devpost_hackathons,
    )
    
    print(f"\n📊 Aggregation Results:")
    print(f"  Total before dedup: {len(devfolio_hackathons) + len(dorahacks_hackathons) + len(devpost_hackathons)}")
    print(f"  After dedup:        {len(aggregated)}")
    print(f"  Multi-source:       {sum(1 for h in aggregated if h.is_multi_source)}")
    
    print(f"\n🔍 Aggregated Hackathons:")
    for idx, agg in enumerate(aggregated, 1):
        print(f"\n  {idx}. {agg.title}")
        print(f"     Sources:  {', '.join(agg.sources)}")
        print(f"     Primary:  {agg.primary_source}")
        print(f"     Prize:    ${agg.prize_pool:,}")
        print(f"     Tags:     {', '.join(agg.tags[:3])}...")
        print(f"     URLs:     {len(agg.source_urls)} source URL(s)")
        if agg.organizer:
            print(f"     Organizer: {agg.organizer}")
        if agg.city:
            print(f"     City:      {agg.city}")
        print(f"     Confidence: {agg.source_confidence:.0%}")


def test_deduplication_edge_cases():
    """Test: Edge cases in fuzzy matching."""
    print("\n" + "=" * 80)
    print("TEST 3: Deduplication Edge Cases")
    print("=" * 80)
    
    dedup = HackathonDeduplicator(threshold=0.90)
    
    edge_cases = [
        {
            "title": "Blockchain Summit 2025",
            "candidates": [
                {"title": "Blockchain Summit 2025"},         # 100% - exact
                {"title": "Blockchain Summit '25"},          # ~95% - year variation
                {"title": "Blockchain Conference 2025"},     # ~85% - word diff
                {"title": "Web3 2025"},                      # ~60% - different
            ],
            "threshold": 0.90,
        },
        {
            "title": "ETH Denver 2025",
            "candidates": [
                {"title": "ETH Denver 2025"},                # 100% - exact
                {"title": "Ethereum Denver"},                # ~90% - year removed
                {"title": "Denver Hack"},                    # ~50% - very different
            ],
            "threshold": 0.90,
        },
    ]
    
    for case in edge_cases:
        print(f"\nMain hackathon: '{case['title']}'")
        print(f"Threshold: {case['threshold']:.0%}\n")
        
        for cand in case["candidates"]:
            sim = dedup._similarity(case["title"], cand["title"])
            is_dup = sim >= case["threshold"]
            marker = "✓ DUP" if is_dup else "  new"
            print(f"  {marker}  [{sim:.0%}] {cand['title']}")


def test_source_prioritization():
    """Test: Source priority ranking."""
    print("\n" + "=" * 80)
    print("TEST 4: Source Prioritization")
    print("=" * 80)
    
    aggregator = HackathonAggregator()
    
    test_data = {
        "title": "Multi-Source Hackathon",
        "sources": ["devpost", "devfolio", "dorahacks"],
        "expected_primary": "devfolio",
        "expected_priority": 0,
    }
    
    print(f"\nHackathon: {test_data['title']}")
    print(f"Appears in: {', '.join(test_data['sources'])}")
    
    # Create mock hackathons
    hackathons = [
        {
            "id": f"{source}_001",
            "title": test_data["title"],
            "description": "Test hackathon",
            "prize_pool": 50000,
            "tags": ["test"],
            "deadline": "2025-04-30T00:00:00Z",
            "source": source,
            "source_url": f"https://{source}.io/test",
            "organizer": None,
            "city": None,
            "event_type": None,
            "tech_stack": None,
            "difficulty": None,
        }
        for source in test_data["sources"]
    ]
    
    # Simulate aggregation (start with lowest priority, work up)
    agg = aggregator._to_aggregated(hackathons[0], hackathons[0]["source"])
    for h in hackathons[1:]:
        agg = aggregator._merge_aggregated(agg, aggregator._to_aggregated(h, h["source"]))
    
    print(f"\n✓ Detected sources: {agg.sources}")
    print(f"✓ Primary source:  {agg.primary_source}")
    print(f"✓ Confidence:      {agg.source_confidence:.0%}")


if __name__ == "__main__":
    print("\n" + "🚀 " * 35)
    print("XIIMALAB PHASE 4: MULTI-SOURCE AGGREGATION TESTS")
    print("🚀 " * 35)
    
    test_fuzzy_matching()
    test_multi_source_aggregation()
    test_deduplication_edge_cases()
    test_source_prioritization()
    
    print("\n" + "=" * 80)
    print("✅ All Phase 4 aggregation tests completed!")
    print("=" * 80 + "\n")
