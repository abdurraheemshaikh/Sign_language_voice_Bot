import pickle

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split


DATA_PATH = "./data3.pickle"
MODEL_OUT_PATH = "./model2.p"


data_dict = pickle.load(open(DATA_PATH, "rb"))
data = np.asarray(data_dict["data"])
labels = np.asarray(data_dict["labels"])

x_train, x_test, y_train, y_test = train_test_split(
    data, labels, test_size=0.2, shuffle=True, stratify=labels
)

model = RandomForestClassifier()
model.fit(x_train, y_train)

y_predict = model.predict(x_test)
score = accuracy_score(y_predict, y_test)
print(f"{score * 100:.2f}% of samples were classified correctly!")

# Keep key name "model" for compatibility with inference scripts and backend API.
with open(MODEL_OUT_PATH, "wb") as f:
    pickle.dump({"model": model}, f)

print(f"Saved trained model to: {MODEL_OUT_PATH}")
