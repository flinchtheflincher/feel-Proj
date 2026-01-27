import csv
import sys
from pathlib import Path

# Ensure script directory is on path so "src" can be imported from anywhere
sys.path.insert(0, str(Path(__file__).resolve().parent))
from src.smallPrediction import linearRegression

X = []
y = []

_data_path = Path(__file__).resolve().parent / "data" / "scores.csv"
with open(_data_path) as file:
    reader = csv.DictReader(file)
    for row in reader:
        X.append(float(row["hours"]))
        y.append(float(row["score"]))
model = linearRegression(learningRate=0.01, epochs=1000)
model.fit(X, y)

hour_input = input("Enter the hours: ").strip()
if not hour_input:
    print("No hours entered.")
else:
    try:
        hours = [float(h.strip()) for h in hour_input.split(",")]
        prediction = model.smallPredict(hours)
        for h, p in zip(hours, prediction):
            print(f"Predict score for {h} hours: {p:.2f}")
    except ValueError:
        print("Invalid input. Enter a number or comma-separated numbers (e.g. 7 or 7, 6, 10).")

