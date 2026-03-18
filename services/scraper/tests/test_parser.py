"""
Unit tests for parser.py — no browser / no network required.
Run: pytest tests/ -v
"""
import pytest
from parser import (
    compute_match_score,
    make_id,
    parse_deadline,
    parse_hackathon_cards,
    parse_prize,
)


# ─────────────────────────────────────────────
# parse_prize
# ─────────────────────────────────────────────
class TestParsePrize:
    def test_dollar_with_commas(self):
        assert parse_prize("$50,000") == 50_000

    def test_k_suffix(self):
        assert parse_prize("75K") == 75_000

    def test_m_suffix(self):
        assert parse_prize("1.5M") == 1_500_000

    def test_plain_number(self):
        assert parse_prize("100000") == 100_000

    def test_empty_string(self):
        assert parse_prize("") == 0

    def test_no_match(self):
        assert parse_prize("TBD") == 0


# ─────────────────────────────────────────────
# parse_deadline
# ─────────────────────────────────────────────
class TestParseDeadline:
    def test_iso_format(self):
        assert parse_deadline("2025-04-15") == "2025-04-15"

    def test_long_month_format(self):
        assert parse_deadline("April 15, 2025") == "2025-04-15"

    def test_short_month_format(self):
        assert parse_deadline("Apr 15, 2025") == "2025-04-15"

    def test_fallback_returns_future_date(self):
        from datetime import date, timedelta
        result = parse_deadline("unknown date")
        parsed = date.fromisoformat(result)
        assert parsed > date.today()


# ─────────────────────────────────────────────
# compute_match_score
# ─────────────────────────────────────────────
class TestMatchScore:
    def test_high_ai_blockchain_score(self):
        score = compute_match_score("AI x Web3 Global Sprint", ["AI", "Web3", "Python", "Blockchain"])
        # High relevance score for AI/Web3 focused hackathon
        assert score >= 25

    def test_low_relevance_score(self):
        score = compute_match_score("Gaming Tournament", ["Gaming", "Esports"])
        assert score <= 20

    def test_score_clamped_0_100(self):
        score = compute_match_score("Python AI ML Data Analytics Docker Blockchain Stellar", ["AI", "ML"])
        assert 0 <= score <= 100

    def test_minimum_score(self):
        score = compute_match_score("", [])
        assert score >= 5  # minimum floor


# ─────────────────────────────────────────────
# make_id
# ─────────────────────────────────────────────
class TestMakeId:
    def test_stable_across_calls(self):
        assert make_id("Stellar Build Challenge") == make_id("Stellar Build Challenge")

    def test_case_insensitive(self):
        assert make_id("STELLAR BUILD") == make_id("stellar build")

    def test_length(self):
        assert len(make_id("any title")) == 12


# ─────────────────────────────────────────────
# parse_hackathon_cards — integration of all parsers
# ─────────────────────────────────────────────
class TestParseHackathonCards:
    CARDS = [
        {
            "title": "Stellar Build Challenge 2025",
            "prize": "$50,000",
            "deadline": "2025-04-15",
            "tags": "Stellar,DeFi,Cross-chain",
            "url": "https://dorahacks.io/hackathon/123",
        },
        {
            "title": "AI x Web3 Global Sprint",
            "prize": "30K",
            "deadline": "April 28, 2025",
            "tags": "AI,Web3,Python",
            "url": "",
        },
    ]

    def test_returns_correct_count(self):
        results = parse_hackathon_cards(self.CARDS, "https://dorahacks.io")
        assert len(results) == 2

    def test_prize_parsed(self):
        results = parse_hackathon_cards(self.CARDS, "https://dorahacks.io")
        assert results[0].prize_pool == 50_000
        assert results[1].prize_pool == 30_000

    def test_tags_are_list(self):
        results = parse_hackathon_cards(self.CARDS, "https://dorahacks.io")
        assert isinstance(results[0].tags, list)
        assert "Stellar" in results[0].tags

    def test_fallback_url(self):
        results = parse_hackathon_cards(self.CARDS, "https://dorahacks.io")
        # Card with empty URL should fall back to base_url
        assert results[1].source_url == "https://dorahacks.io"

    def test_match_score_range(self):
        results = parse_hackathon_cards(self.CARDS, "https://dorahacks.io")
        for h in results:
            assert 0 <= h.match_score <= 100
