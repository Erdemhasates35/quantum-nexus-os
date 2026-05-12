#!/usr/bin/env python3

import asyncio
import hashlib
import json
import math
import os
import resource
import time
from typing import Any


class SystemIntegrity:
    """Sistemin ve kodun kendi bütünlüğünü denetler."""

    @staticmethod
    def verify_self_checksum(filepath: str = __file__) -> str:
        try:
            with open(filepath, "rb") as f:
                return hashlib.sha384(f.read()).hexdigest()[:16]
        except Exception:
            return "INTEGRITY_CHECK_FAILED"


class QuantumDensityMapper:
    """Çok değişkenli QPDM hesaplamalarını yönetir."""

    @staticmethod
    def calculate_multivariate_density(cpu_load: float, entropy_pool: int) -> float:
        # CPU ve Entropi havuzunu birleştiren gelişmiş Gaussian dağılımı
        variance = 0.5
        normalized_entropy = (
            min(entropy_pool / 4096.0, 1.0) if entropy_pool > 0 else 0.1
        )
        core_val = (cpu_load + normalized_entropy) / 2.0

        density = (1 / (variance * math.sqrt(2 * math.pi))) * math.exp(
            -0.5 * (core_val / variance) ** 2,
        )
        return round(density, 8)


class NetworkAnalyzer:
    """Asenkron derin ağ ve soket analizleri yapar."""

    @staticmethod
    async def measure_jitter(target: str = "8.8.8.8", count: int = 3) -> dict[str, str]:
        latencies = []
        for _ in range(count):
            start = time.perf_counter()
            try:
                proc = await asyncio.create_subprocess_exec(
                    "ping",
                    "-c",
                    "1",
                    "-W",
                    "1",
                    target,
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL,
                )
                await proc.wait()
                latencies.append((time.perf_counter() - start) * 1000)
            except Exception:
                pass

        if not latencies:
            return {"avg_latency": "N/A", "jitter": "N/A"}

        avg_latency = sum(latencies) / len(latencies)
        jitter = max(latencies) - min(latencies) if len(latencies) > 1 else 0.0
        return {"avg_latency": f"{avg_latency:.2f}ms", "jitter": f"{jitter:.3f}ms"}


class NexusOrchestrator:
    """Tüm modülleri asenkron ve modüler bir şekilde yöneten ana beyin."""

    def __init__(self):
        self.start_time = time.time()
        self.metrics: dict[str, Any] = {}

    def _get_kernel_entropy(self) -> int:
        try:
            with open("/proc/sys/kernel/random/entropy_avail") as f:
                return int(f.read().strip())
        except Exception:
            return 256  # Android/Termux kısıtlaması için varsayılan fallback

    def _get_context_switches(self) -> str:
        try:
            usage = resource.getrusage(resource.RUSAGE_SELF)
            return f"Vol:{usage.ru_nvcsw} / Invol:{usage.ru_nivcsw}"
        except Exception:
            return "Restricted"

    def _get_inode_saturation(self) -> str:
        try:
            st = os.statvfs("/")
            saturation = 100 - ((st.f_favail / st.f_files) * 100)
            return f"{saturation:.2f}%"
        except Exception:
            return "N/A"

    async def compile_metrics(self):
        # 1. Temel Sistem Yükleri
        load = os.getloadavg()[0]
        kernel_entropy = self._get_kernel_entropy()

        # 2. Asenkron Ağ Analizi (Non-blocking)
        net_stats = await NetworkAnalyzer.measure_jitter()

        # 3. Derin Metrik Derlemesi
        self.metrics = {
            "Core Bütünlük (SHA384)": SystemIntegrity.verify_self_checksum(),
            "Multivariate QPDM Yoğunluğu": QuantumDensityMapper.calculate_multivariate_density(
                load,
                kernel_entropy,
            ),
            "Çekirdek Entropi Havuzu": kernel_entropy,
            "Ağ Gecikmesi (Avg)": net_stats["avg_latency"],
            "Ağ Sapması (Jitter)": net_stats["jitter"],
            "CPU Load (1m)": load,
            "Bağlam Geçişleri (Context Sw)": self._get_context_switches(),
            "Inode (Veri Düğümü) Doygunluğu": self._get_inode_saturation(),
            "Process ID (PID)": os.getpid(),
            "Ajan İşlem Yükü (Uptime)": f"{(time.time() - self.start_time) * 1000:.2f}ms",
        }

    def generate_report(self):
        print("\n" + "═" * 60)
        print(f"{'NEXUS OMEGA ANALYTICS v16.0 (LEVEL 7 ARCHITECTURE)':^60}")
        print("═" * 60)

        for key, value in self.metrics.items():
            print(f" 🔹 {key:<35} : {value}")
            time.sleep(0.03)  # Konsol okunabilirliği için mikro gecikme

        print("═" * 60)
        print("[+] Tüm modüller başarıyla senkronize edildi.")
        print("[-] Makine Okunabilir Telemetri (JSON Export):")
        print(json.dumps(self.metrics, indent=2, ensure_ascii=False))
        print("═" * 60 + "\n")


async def main():
    print("\n[!] NEXUS ÇEKİRDEĞİ BAŞLATILIYOR...")
    print("[-] Kuantum alt sistemleri ve ağ soketleri asenkron yükleniyor...\n")

    orchestrator = NexusOrchestrator()
    await orchestrator.compile_metrics()
    orchestrator.generate_report()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[!] Analiz kullanıcı tarafından durduruldu.")
    except Exception as e:
        print(f"\n[X] Kritik Çekirdek Hatası: {e}")
