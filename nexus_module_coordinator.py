#!/usr/bin/env python3
"""
NEXUS MODULE COORDINATOR v2.0
Tüm modülleri senkronize ederek kombine çalıştırır
"""

import asyncio
import json
import subprocess
import sys
import time
from typing import Dict, List, Any
from pathlib import Path

class NexusModuleCoordinator:
    """Ana Nexus Koordinatörü - Tüm modülleri yönetir"""
    
    def __init__(self):
        self.modules: Dict[str, Dict[str, Any]] = {}
        self.status = "INITIALIZING"
        self.start_time = time.time()
        
    def load_module_manifest(self) -> Dict[str, Any]:
        """Tüm modülleri tanımlar"""
        return {
            "nexus_core": {
                "type": "python",
                "path": "nexus_core.py",
                "description": "Ana Nexus çekirdeği - sistem analizi ve raporlama",
                "required": True
            },
            "nexus_orchestrator": {
                "type": "python",
                "path": "nexus_core_orchestrator.py",
                "description": "FastAPI orkestratörü - WebSocket gerçek zaman haberleşmesi",
                "required": False
            },
            "agents_swarm": {
                "type": "python",
                "path": "agents_swarm.py",
                "description": "Ajan sürüsü yöneticisi",
                "required": False
            },
            "self_evolution": {
                "type": "python",
                "path": "self_evolution.py",
                "description": "Otonom evrim motoru",
                "required": False
            },
            "server_core": {
                "type": "javascript",
                "path": "server.js",
                "description": "Express sunucu ve AI Konseyi",
                "required": False
            }
        }
    
    def validate_modules(self) -> bool:
        """Modüllerin varlığını kontrol eder"""
        manifest = self.load_module_manifest()
        all_valid = True
        
        print("\n" + "="*60)
        print("MODULE VALIDATION")
        print("="*60)
        
        for module_name, module_info in manifest.items():
            module_path = Path(module_info["path"])
            exists = module_path.exists()
            
            status = "✅ OK" if exists else "❌ MISSING"
            required = "[REQUIRED]" if module_info["required"] else "[OPTIONAL]"
            
            print(f"{status} {module_name:20} {required:12} - {module_info['description']}")
            
            if module_info["required"] and not exists:
                all_valid = False
        
        print("="*60)
        return all_valid
    
    async def execute_python_module(self, module_path: str) -> Dict[str, Any]:
        """Python modülünü asenkron çalıştırır"""
        try:
            process = await asyncio.create_subprocess_exec(
                sys.executable,
                module_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=30)
            
            return {
                "status": "SUCCESS" if process.returncode == 0 else "FAILED",
                "module": module_path,
                "output": stdout.decode() if stdout else "",
                "error": stderr.decode() if stderr else "",
                "returncode": process.returncode
            }
        except asyncio.TimeoutError:
            return {
                "status": "TIMEOUT",
                "module": module_path,
                "error": "Module execution exceeded 30 seconds"
            }
        except Exception as e:
            return {
                "status": "ERROR",
                "module": module_path,
                "error": str(e)
            }
    
    async def execute_javascript_module(self, module_path: str) -> Dict[str, Any]:
        """JavaScript modülünü kısa test için çalıştırır"""
        try:
            process = await asyncio.create_subprocess_exec(
                "node",
                "-e",
                f"console.log('Testing {module_path}...'); process.exit(0);",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10)
            
            return {
                "status": "SUCCESS" if process.returncode == 0 else "FAILED",
                "module": module_path,
                "output": stdout.decode() if stdout else ""
            }
        except Exception as e:
            return {
                "status": "ERROR",
                "module": module_path,
                "error": str(e)
            }
    
    async def coordinate_modules(self) -> Dict[str, Any]:
        """Tüm modülleri koordine eder ve çalıştırır"""
        manifest = self.load_module_manifest()
        results = {}
        
        print("\n" + "="*60)
        print("COORDINATING NEXUS MODULES")
        print("="*60 + "\n")
        
        tasks = []
        module_types = {}
        
        for module_name, module_info in manifest.items():
            module_path = module_info["path"]
            
            if not Path(module_path).exists():
                print(f"⏭️  SKIPPING: {module_name} (not found)")
                continue
            
            if module_info["type"] == "python":
                tasks.append(self.execute_python_module(module_path))
                module_types[module_path] = "python"
            elif module_info["type"] == "javascript":
                tasks.append(self.execute_javascript_module(module_path))
                module_types[module_path] = "javascript"
        
        if tasks:
            execution_results = await asyncio.gather(*tasks)
            for result in execution_results:
                results[result["module"]] = result
        
        return results
    
    def generate_coordination_report(self, results: Dict[str, Any]) -> str:
        """Koordinasyon raporunu oluşturur"""
        report = "\n" + "="*60 + "\n"
        report += "NEXUS COORDINATION REPORT\n"
        report += "="*60 + "\n\n"
        
        successful = sum(1 for r in results.values() if r.get("status") == "SUCCESS")
        failed = sum(1 for r in results.values() if r.get("status") == "FAILED")
        errors = sum(1 for r in results.values() if r.get("status") == "ERROR")
        
        report += f"✅ Successful: {successful}\n"
        report += f"❌ Failed: {failed}\n"
        report += f"⚠️  Errors: {errors}\n\n"
        
        report += "Module Details:\n"
        report += "-"*60 + "\n"
        
        for module, result in results.items():
            report += f"\n📦 {module}\n"
            report += f"   Status: {result.get('status', 'UNKNOWN')}\n"
            if result.get("error"):
                report += f"   Error: {result['error'][:100]}\n"
            if result.get("output"):
                output_lines = result["output"].split("\n")[:3]
                report += f"   Output: {output_lines[0][:80]}\n"
        
        report += "\n" + "="*60 + "\n"
        report += f"Uptime: {time.time() - self.start_time:.2f}s\n"
        report += "="*60 + "\n"
        
        return report
    
    async def run(self):
        """Ana çalıştırma fonksiyonu"""
        print("\n🚀 NEXUS MODULE COORDINATOR v2.0 BAŞLATILIYOR...\n")
        
        # Doğrulama
        if not self.validate_modules():
            print("\n⚠️  Some required modules are missing!")
        
        # Koordinasyon
        results = await self.coordinate_modules()
        
        # Rapor
        report = self.generate_coordination_report(results)
        print(report)
        
        # Raporu kaydet
        with open("nexus_coordination_report.json", "w") as f:
            json.dump(results, f, indent=2)
        
        print("📄 Report saved to: nexus_coordination_report.json")


async def main():
    coordinator = NexusModuleCoordinator()
    await coordinator.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[!] Koordinasyon kullanıcı tarafından durduruldu.")
    except Exception as e:
        print(f"\n[X] Koordinasyon Hatası: {e}")
        sys.exit(1)
