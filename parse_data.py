import csv
import json
import os

def parse_sum(sum_str):
    if not sum_str:
        return 0
    clean_str = sum_str.replace('\xa0', '').replace(' ', '').replace(',', '.')
    clean_str = "".join(c for c in clean_str if c.isdigit() or c == '.')
    try:
        if not clean_str: return 0
        return float(clean_str)
    except ValueError:
        return 0

def parse_csv(file_path):
    items = []
    current_main_category = "Asosiy"
    current_sub_category = "Umumiy"
    
    # Check what known main categories exist
    known_mains = ["musiqa cholg'ular", "kompyuter texnikalari", "mebellar", "sport jihozlari"]
    
    # Try different encodings
    for encoding in ['utf-8', 'utf-8-sig', 'cp1251', 'latin-1']:
        try:
            with open(file_path, mode='r', encoding=encoding) as f:
                reader = csv.reader(f)
                header = next(reader)
                
                for row in reader:
                    if not row or not any(row): continue
                    
                    first_col = row[0].strip()
                    if first_col == 'N': continue
                    
                    # If the first column is not a number, it's a category
                    if not first_col.isdigit():
                        cat_name = first_col
                        # Check if it's a main category
                        if any(km in cat_name.lower() for km in known_mains) and "lar" in cat_name.lower() and not "lari" in cat_name.lower():
                            current_main_category = cat_name
                            current_sub_category = "Umumiy"
                        elif cat_name.lower().strip() == "musiqa cholg'ular":
                            current_main_category = cat_name
                            current_sub_category = "Umumiy"
                        else:
                            # It's a sub-category
                            if current_main_category == "Asosiy":
                                current_main_category = cat_name
                            else:
                                current_sub_category = cat_name
                        continue
                        
                    if first_col.isdigit():
                        item = {
                            "id": first_col,
                            "name": row[1].strip() if len(row) > 1 else "",
                            "inv_number": row[2].strip() if len(row) > 2 else "",
                            "quantity": int(row[3]) if len(row) > 3 and row[3].strip().isdigit() else 1,
                            "price": parse_sum(row[4]) if len(row) > 4 else 0,
                            "parameters": row[5].strip() if len(row) > 5 else "",
                            "responsible": row[6].strip() if len(row) > 6 else "",
                            "room": row[7].strip() if len(row) > 7 else "",
                            "status": row[8].strip() if len(row) > 8 else "",
                            "serial": row[9].strip() if len(row) > 9 else "",
                            "main_category": current_main_category,
                            "sub_category": current_sub_category
                        }
                        items.append(item)
                return items
        except (UnicodeDecodeError, StopIteration):
            continue
    return []

csv_path = r'c:\Users\User\Desktop\omborxona\MESI omborxona raqamli tizimi - Лист1.csv'
data = parse_csv(csv_path)

if not data:
    print("Error: No data parsed. Check CSV format and encoding.")
    exit(1)

output_dir = r'c:\Users\User\Desktop\omborxona\dashboard'
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

with open(os.path.join(output_dir, 'data.js'), 'w', encoding='utf-8') as f:
    f.write("const inventoryData = " + json.dumps(data, indent=2, ensure_ascii=False) + ";")

print(f"Successfully processed {len(data)} items.")
