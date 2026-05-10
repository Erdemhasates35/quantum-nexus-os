import json


def update_ui_data(signal_data, threat_count):
    # Bu fonksiyon index.html üzerindeki 'tb-thr' ve 'csi' alanlarını tetikler
    ui_package = {"threats": threat_count, "signal": signal_data, "status": "ACTIVE"}
    return json.dumps(ui_package)


print("Web Bridge: ONLINE")
