#!/bin/bash
set -e

echo "=========================================="
echo "Retail Sales Analysis - Reference Solution"
echo "=========================================="

cd /app

# Write solution.py from this script
cat > solution.py <<'PY'
#!/usr/bin/env python3
"""
Retail Sales Analysis - Reference Solution

Analyzes sales data and generates required reports.
"""

import json
import pandas as pd
from pathlib import Path

DATA_DIR = Path("data")
OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

def main():
    print("Loading data...")
    sales = pd.read_csv(DATA_DIR / "sales.csv")
    products = pd.read_csv(DATA_DIR / "products.csv")

    # Parse dates
    sales['date'] = pd.to_datetime(sales['date'])
    sales['month'] = sales['date'].dt.to_period('M').astype(str)

    # Calculate revenue per transaction
    sales['revenue'] = sales['quantity'] * sales['unit_price']

    # Merge with products for cost data
    sales_with_cost = sales.merge(products[['product_id', 'cost']], on='product_id')
    sales_with_cost['total_cost'] = sales_with_cost['quantity'] * sales_with_cost['cost']

    # === 1. Summary Report ===
    print("Generating summary report...")

    total_revenue = round(sales['revenue'].sum(), 2)
    total_transactions = len(sales)
    avg_order_value = round(total_revenue / total_transactions, 2)

    # Top category by revenue
    category_revenue = sales.groupby('category')['revenue'].sum()
    top_category = category_revenue.idxmax()

    # Top product by units
    product_units = sales.groupby('product_id')['quantity'].sum()
    top_product_id = product_units.idxmax()
    top_product = products[products['product_id'] == top_product_id]['name'].values[0]

    summary = {
        "total_revenue": total_revenue,
        "total_transactions": total_transactions,
        "top_category": top_category,
        "top_product": top_product,
        "avg_order_value": avg_order_value
    }

    with open(OUTPUT_DIR / "summary_report.json", "w") as f:
        json.dump(summary, f, indent=2)

    # === 2. Monthly Trends ===
    print("Generating monthly trends...")

    monthly = sales.groupby('month').agg({
        'revenue': 'sum',
        'transaction_id': 'count'
    }).reset_index()
    monthly.columns = ['month', 'revenue', 'transactions']
    monthly['revenue'] = monthly['revenue'].round(2)
    monthly.to_csv(OUTPUT_DIR / "monthly_trends.csv", index=False)

    # === 3. Category Analysis ===
    print("Generating category analysis...")

    category_analysis = sales_with_cost.groupby('category').agg({
        'revenue': 'sum',
        'quantity': 'sum',
        'total_cost': 'sum'
    }).reset_index()

    category_analysis['profit_margin'] = (
        (category_analysis['revenue'] - category_analysis['total_cost'])
        / category_analysis['revenue']
    ).round(4)

    category_analysis = category_analysis.rename(columns={'quantity': 'units_sold'})
    category_analysis['revenue'] = category_analysis['revenue'].round(2)
    category_analysis = category_analysis[['category', 'revenue', 'units_sold', 'profit_margin']]
    category_analysis.to_csv(OUTPUT_DIR / "category_analysis.csv", index=False)

    print("Done! Output files created in /app/output/")

if __name__ == "__main__":
    main()
PY

# Run the solution
python3 solution.py
