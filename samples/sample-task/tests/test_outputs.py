#!/usr/bin/env python3
"""
Retail Sales Analysis - Test Suite

Tests validate the output files against expected results.
"""

import json
import csv
from pathlib import Path
import pytest

OUTPUT_DIR = Path("/app/output")


class TestSummaryReport:
    """Tests for summary_report.json"""

    @pytest.fixture
    def summary(self):
        path = OUTPUT_DIR / "summary_report.json"
        assert path.exists(), "summary_report.json not found"
        with open(path) as f:
            return json.load(f)

    def test_summary_file_exists(self):
        """Check that summary_report.json exists"""
        assert (OUTPUT_DIR / "summary_report.json").exists()

    def test_summary_has_required_fields(self, summary):
        """Check all required fields are present"""
        required = [
            "total_revenue",
            "total_transactions",
            "top_category",
            "top_product",
            "avg_order_value"
        ]
        for field in required:
            assert field in summary, f"Missing field: {field}"

    def test_total_revenue_positive(self, summary):
        """Revenue should be positive"""
        assert summary["total_revenue"] > 0

    def test_total_transactions_positive(self, summary):
        """Transactions count should be positive"""
        assert summary["total_transactions"] > 0

    def test_avg_order_value_calculated(self, summary):
        """Average order value should be revenue / transactions"""
        expected = round(
            summary["total_revenue"] / summary["total_transactions"], 2
        )
        assert abs(summary["avg_order_value"] - expected) < 0.01


class TestMonthlyTrends:
    """Tests for monthly_trends.csv"""

    def test_monthly_file_exists(self):
        """Check that monthly_trends.csv exists"""
        assert (OUTPUT_DIR / "monthly_trends.csv").exists()

    def test_monthly_has_required_columns(self):
        """Check CSV has required columns"""
        path = OUTPUT_DIR / "monthly_trends.csv"
        with open(path) as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
        required = ["month", "revenue", "transactions"]
        for col in required:
            assert col in headers, f"Missing column: {col}"

    def test_monthly_has_data(self):
        """Check CSV has data rows"""
        path = OUTPUT_DIR / "monthly_trends.csv"
        with open(path) as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        assert len(rows) > 0, "No data in monthly_trends.csv"


class TestCategoryAnalysis:
    """Tests for category_analysis.csv"""

    def test_category_file_exists(self):
        """Check that category_analysis.csv exists"""
        assert (OUTPUT_DIR / "category_analysis.csv").exists()

    def test_category_has_required_columns(self):
        """Check CSV has required columns"""
        path = OUTPUT_DIR / "category_analysis.csv"
        with open(path) as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
        required = ["category", "revenue", "units_sold", "profit_margin"]
        for col in required:
            assert col in headers, f"Missing column: {col}"

    def test_profit_margins_valid(self):
        """Profit margins should be between 0 and 1"""
        path = OUTPUT_DIR / "category_analysis.csv"
        with open(path) as f:
            reader = csv.DictReader(f)
            for row in reader:
                margin = float(row["profit_margin"])
                assert 0 <= margin <= 1, f"Invalid margin: {margin}"
