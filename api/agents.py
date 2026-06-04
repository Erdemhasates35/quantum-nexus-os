from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import asyncio
import os
from datetime import datetime

app = FastAPI()

class AgentTask(BaseModel):
    agent_id: str
    task: str
    priority: int = 5

class NexusAgent:
    def __init__(self, agent_id: str, name: str):
        self.agent_id = agent_id
        self.name = name
        self.status = "idle"
        self.tasks_completed = 0
        self.start_time = datetime.now()
    
    async def execute_task(self, task: str):
        self.status = "executing"
        print(f"[AGENT-{self.name}] Executing: {task}")
        await asyncio.sleep(2)
        self.tasks_completed += 1
        self.status = "idle"
        return {"status": "complete", "task": task, "agent": self.name}

agents = {
    "ar-ge": NexusAgent("ar-ge", "AR-GE"),
    "security": NexusAgent("sec", "Security Shield"),
    "finance": NexusAgent("fin", "Finance Engine"),
    "data": NexusAgent("data", "Data Swarm"),
    "ml": NexusAgent("ml", "ML Pipeline"),
    "marketing": NexusAgent("mkt", "Marketing AI"),
    "strategy": NexusAgent("strat", "Strategy Agent"),
    "evolution": NexusAgent("evo", "Self-Evolution"),
}

@app.get("/api/agents/status")
async def get_agents_status():
    return {
        "agents": [
            {
                "id": k,
                "name": v.name,
                "status": v.status,
                "tasks_completed": v.tasks_completed,
                "uptime_minutes": int((datetime.now() - v.start_time).total_seconds() / 60)
            }
            for k, v in agents.items()
        ],
        "total_active": len([a for a in agents.values() if a.status == "executing"]),
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/agents/execute")
async def execute_agent_task(task: AgentTask):
    if task.agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent = agents[task.agent_id]
    result = await agent.execute_task(task.task)
    
    return result

@app.post("/api/agents/swarm")
async def swarm_execute(tasks: list[AgentTask]):
    results = []
    for task in tasks:
        if task.agent_id in agents:
            result = await agents[task.agent_id].execute_task(task.task)
            results.append(result)
    
    return {"results": results, "total": len(results), "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
