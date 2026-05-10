import numpy as np


def filter_noise(signal):
    # Level 5: Gürültü temizleme algoritması
    return np.convolve(signal, np.ones(5) / 5, mode="valid")


def analyze_presence(csi_data):
    # Level 4: CSI veri analizi
    energy = np.sum(np.square(csi_data))
    return "Movement Detected" if energy > 0.05 else "Static Environment"


print("CSI Processor Engine: ACTIVE")
