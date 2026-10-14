import csv
import html
import re
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape


OUT = Path(__file__).resolve().parent

# 20 example collections, five sample products per collection.
CATEGORIES = [
    ("Wood Pressed Oils", "wood-pressed-oils", "500 ml", "1 L", 219, "ml", ["Wood Pressed Groundnut Oil", "Wood Pressed Sesame Oil", "Wood Pressed Coconut Oil", "Wood Pressed Mustard Oil", "Wood Pressed Safflower Oil"]),
    ("Flour & Multigrain", "flour-multigrain", "1 kg", "5 kg", 99, "g", ["Stone Ground Chakki Atta", "Multigrain Atta", "Ragi Flour", "Jowar Flour", "Besan Gram Flour"]),
    ("Spices", "spices", "100 g", "200 g", 69, "g", ["Lakadong Turmeric Powder", "Byadgi Red Chilli Powder", "Coriander Powder", "Whole Cumin Seeds", "Whole Black Pepper"]),
    ("Millets", "millets", "500 g", "1 kg", 89, "g", ["Foxtail Millet", "Little Millet", "Barnyard Millet", "Pearl Millet", "Finger Millet"]),
    ("Pulses & Lentils", "pulses-lentils", "500 g", "1 kg", 79, "g", ["Toor Dal", "Green Moong Dal", "Whole Masoor Dal", "Chana Dal", "Urad Dal Split"]),
    ("Dry Fruits & Dates", "dry-fruits-dates", "250 g", "500 g", 199, "g", ["Medjool Dates", "Golden Raisins", "Dried Turkish Figs", "Dried Apricots", "Dried Cranberries"]),
    ("Nuts & Seeds", "nuts-seeds", "200 g", "500 g", 189, "g", ["California Almonds", "Whole Cashews", "Walnut Kernels", "Pumpkin Seeds", "Sunflower Seeds"]),
    ("Fresh Nut Butters", "fresh-nut-butters", "250 g", "500 g", 249, "g", ["Creamy Almond Butter", "Crunchy Peanut Butter", "Cashew Butter", "Hazelnut Cocoa Spread", "Mixed Seed Butter"]),
    ("Quick Bites", "quick-bites", "150 g", "300 g", 99, "g", ["Classic Roasted Makhana", "Millet Chivda", "Jaggery Peanut Bites", "Fruit and Nut Trail Mix", "Roasted Chana Snack"]),
    ("Coffee & Tea", "coffee-tea", "100 g", "250 g", 149, "g", ["South Indian Filter Coffee", "Green Tea Leaves", "Masala Chai Blend", "Turmeric Latte Mix", "Ginger Tea Blend"]),
    ("Health Foods", "health-foods", "250 g", "500 g", 129, "g", ["Chia Seeds", "Golden Flax Seeds", "Moringa Leaf Powder", "Sprouted Ragi Mix", "Rolled Oats"]),
    ("Natural Sweeteners", "natural-sweeteners", "250 g", "500 g", 149, "g", ["Organic Jaggery Powder", "Raw Forest Honey", "Date Syrup", "Coconut Sugar", "Traditional Khandsari Sugar"]),
    ("Pasta & Noodles", "pasta-noodles", "400 g", "800 g", 79, "g", ["Millet Penne Pasta", "Whole Wheat Fusilli", "Red Rice Noodles", "Roasted Vermicelli", "Ragi Noodles"]),
    ("Pickles", "pickles", "250 g", "500 g", 129, "g", ["Traditional Mango Pickle", "Lime Pickle", "Gongura Pickle", "Mixed Vegetable Pickle", "Garlic Chilli Pickle"]),
    ("Masalas", "masalas", "100 g", "200 g", 79, "g", ["Garam Masala", "Sambar Masala", "Rasam Powder", "Chaat Masala", "Biryani Masala"]),
    ("Rice & Grains", "rice-grains", "1 kg", "5 kg", 149, "g", ["Aged Basmati Rice", "Sona Masuri Rice", "Brown Rice", "Red Rice", "Thick Poha"]),
    ("Ghee & Dairy", "ghee-dairy", "500 g", "1 kg", 399, "g", ["Cultured Cow Ghee", "Buffalo Ghee", "A2 Cow Ghee", "Bilona Ghee", "Spiced Cow Ghee"]),
    ("Breakfast Essentials", "breakfast-essentials", "500 g", "1 kg", 129, "g", ["Quick Cook Rolled Oats", "Poha Breakfast Mix", "Ragi Porridge Mix", "Instant Dosa Mix", "Wholegrain Pancake Mix"]),
    ("Snacks & Munchies", "snacks-munchies", "100 g", "250 g", 79, "g", ["Banana Chips", "Millet Crackers", "Roasted Peanuts", "Baked Masala Mathri", "Jowar Puffs"]),
    ("Herbal & Wellness", "herbal-wellness", "100 g", "250 g", 129, "g", ["Tulsi Herbal Infusion", "Amla Powder", "Triphala Blend", "Ashwagandha Powder", "Moringa Herbal Tea"]),
]

HEADERS = [
    "Handle", "Title", "Body (HTML)", "Vendor", "Product Category", "Type", "Tags", "Published",
    "Option1 Name", "Option1 Value", "Option1 Linked To", "Option2 Name", "Option2 Value", "Option2 Linked To",
    "Option3 Name", "Option3 Value", "Option3 Linked To", "Variant SKU", "Variant Grams", "Variant Inventory Tracker",
    "Variant Inventory Qty", "Variant Inventory Policy", "Variant Fulfillment Service", "Variant Price", "Variant Compare At Price",
    "Variant Requires Shipping", "Variant Taxable", "Unit Price Total Measure", "Unit Price Total Measure Unit",
    "Unit Price Base Measure", "Unit Price Base Measure Unit", "Variant Barcode", "Image Src", "Image Position",
    "Image Alt Text", "Gift Card", "SEO Title", "SEO Description", "Google Shopping / Google Product Category",
    "Google Shopping / Gender", "Google Shopping / Age Group", "Google Shopping / MPN", "Google Shopping / Condition",
    "Google Shopping / Custom Product", "Google Shopping / Custom Label 0", "Google Shopping / Custom Label 1",
    "Google Shopping / Custom Label 2", "Google Shopping / Custom Label 3", "Google Shopping / Custom Label 4",
    "Variant Image", "Variant Weight Unit", "Variant Tax Code", "Cost per item", "Status",
]


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def package_measure(label):
    amount, unit = label.split()
    amount = float(amount)
    if unit.lower() == "kg":
        return amount, "kg", 1, "kg", amount * 1000
    if unit.lower() == "l":
        return amount, "l", 1, "l", amount * 1000
    if unit.lower() == "ml":
        return amount, "ml", 100, "ml", amount
    return amount, unit.lower(), 100, unit.lower(), amount


def row_for(product, category, category_handle, pack, price, sku):
    title = product
    title_without_pack = product
    grams = int(package_measure(pack)[4])
    if package_measure(pack)[1] == "ml":
        grams = int(grams * 1.0)
    tags = ", ".join(["FreshOMill Sample", category_handle, slug(product.split()[0])])
    desc = (
        f"<p><strong>{html.escape(product)}</strong> is a sample catalog listing for FreshOMill's {html.escape(category)} range.</p>"
        f"<ul><li>Pack size: {html.escape(pack)}</li><li>Product type: {html.escape(category)}</li>"
        f"<li>Sample retail price: Rs. {price:.2f}</li></ul>"
        "<p><em>Sample content: confirm ingredients, origin, processing, storage guidance, nutrition and regulatory details against the actual product before publishing.</em></p>"
    )
    measure, measure_unit, base, base_unit, _ = package_measure(pack)
    data = {h: "" for h in HEADERS}
    data.update({
        "Handle": slug(product), "Title": title, "Body (HTML)": desc, "Vendor": "FreshOMill",
        "Product Category": "", "Type": category, "Tags": tags, "Published": "FALSE",
        "Option1 Name": "Pack Size", "Option1 Value": pack, "Variant SKU": sku,
        "Variant Grams": str(grams), "Variant Inventory Tracker": "shopify", "Variant Inventory Qty": "25",
        "Variant Inventory Policy": "deny", "Variant Fulfillment Service": "manual", "Variant Price": f"{price:.2f}",
        "Variant Compare At Price": "", "Variant Requires Shipping": "TRUE", "Variant Taxable": "TRUE",
        "Unit Price Total Measure": f"{measure:g}", "Unit Price Total Measure Unit": measure_unit,
        "Unit Price Base Measure": f"{base:g}", "Unit Price Base Measure Unit": base_unit,
        "Gift Card": "FALSE", "SEO Title": title_without_pack[:70],
        "SEO Description": f"Shop sample {product.lower()} from FreshOMill. Sample listing; verify product facts before sale."[:320],
        "Google Shopping / Condition": "new", "Google Shopping / Custom Product": "TRUE",
        "Google Shopping / Custom Label 0": "sample-data", "Variant Weight Unit": "g",
        "Cost per item": f"{price * 0.60:.2f}", "Status": "draft",
    })
    return [data[h] for h in HEADERS]


def make_rows():
    rows = []
    products_count = 0
    for category, category_handle, small_pack, large_pack, base_price, _, products in CATEGORIES:
        for i, product in enumerate(products, 1):
            products_count += 1
            small_price = base_price + (i - 1) * 10
            large_price = round(small_price * 1.85 / 10) * 10 - 1
            rows.append(row_for(product, category, category_handle, small_pack, small_price, f"FOM-{category_handle[:5].upper()}-{i:02d}-S"))
            rows.append(row_for(product, category, category_handle, large_pack, large_price, f"FOM-{category_handle[:5].upper()}-{i:02d}-L"))
    assert products_count == 100
    return rows


def col_name(number):
    result = ""
    while number:
        number, rem = divmod(number - 1, 26)
        result = chr(65 + rem) + result
    return result


def xlsx_cell(ref, value, style=None):
    style_attr = f' s="{style}"' if style else ""
    if isinstance(value, (int, float)) and str(value).strip():
        return f'<c r="{ref}"{style_attr}><v>{value}</v></c>'
    return f'<c r="{ref}" t="inlineStr"{style_attr}><is><t xml:space="preserve">{escape(str(value))}</t></is></c>'


def worksheet_xml(rows, widths=None, freeze_header=False, auto_filter=False):
    max_cols = max((len(row) for row in rows), default=1)
    max_rows = len(rows)
    end = f"{col_name(max_cols)}{max_rows}"
    cols = ""
    if widths:
        cols = "<cols>" + "".join(f'<col min="{i}" max="{i}" width="{w}" customWidth="1"/>' for i, w in enumerate(widths, 1)) + "</cols>"
    view = '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>' if freeze_header else '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
    body = []
    for r, row in enumerate(rows, 1):
        cells = "".join(xlsx_cell(f"{col_name(c)}{r}", v, 1 if r == 1 else None) for c, v in enumerate(row, 1))
        body.append(f'<row r="{r}">{cells}</row>')
    filter_xml = f'<autoFilter ref="A1:{end}"/>' if auto_filter else ""
    return f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:{end}"/>{view}{cols}<sheetFormatPr defaultRowHeight="18"/><sheetData>{"".join(body)}</sheetData>{filter_xml}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>'


def write_xlsx(rows):
    readme = [
        ["FreshOMill Sample Product Import — 100 Products"],
        ["Workbook contains 100 unique sample products across 20 categories and two pack-size variants per product."],
        ["Shopify imports product data from CSV, not XLSX. Import the companion freshomill_sample_products_100.csv file."],
        ["Use the Product Import sheet as the editable source of truth. Export that sheet as CSV UTF-8 when updating Shopify."],
        ["Image Src, Image Position, Image Alt Text, Variant Image and barcode fields are intentionally blank for you to fill."],
        ["Products are marked Draft and Published FALSE so sample listings are not published accidentally."],
        ["Descriptions, prices, inventory and costs are sample values. Verify all factual, tax, inventory and pricing details before publishing."],
        ["Category assignment uses the Product Type and category-handle tag; confirm each existing Shopify collection uses matching rules."],
    ]
    summary = [["Category", "Sample products", "Variants"]] + [[c[0], 5, 10] for c in CATEGORIES]
    widths = [max(14, min(42, len(h) + 3)) for h in HEADERS]
    widths[0], widths[1], widths[2] = 28, 34, 70
    widths[6], widths[32], widths[34] = 32, 38, 40
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'''
    workbook = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Read Me" sheetId="1" r:id="rId1"/><sheet name="Product Import" sheetId="2" r:id="rId2"/><sheet name="Category Summary" sheetId="3" r:id="rId3"/></sheets></workbook>'''
    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'''
    root_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'''
    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF145B35"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'''
    files = {
        "[Content_Types].xml": content_types,
        "_rels/.rels": root_rels,
        "xl/workbook.xml": workbook,
        "xl/_rels/workbook.xml.rels": rels,
        "xl/styles.xml": styles,
        "xl/worksheets/sheet1.xml": worksheet_xml(readme, [110]),
        "xl/worksheets/sheet2.xml": worksheet_xml([HEADERS] + rows, widths, freeze_header=True, auto_filter=True),
        "xl/worksheets/sheet3.xml": worksheet_xml(summary, [32, 20, 14], freeze_header=True, auto_filter=True),
    }
    target = OUT / "freshomill_sample_products_100.xlsx"
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return target


def main():
    rows = make_rows()
    csv_path = OUT / "freshomill_sample_products_100.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        writer.writerow(HEADERS)
        writer.writerows(rows)
    xlsx_path = write_xlsx(rows)
    print(f"Created {xlsx_path} ({len(rows)} variant rows, 100 products, 20 categories)")
    print(f"Created {csv_path}")


if __name__ == "__main__":
    main()
