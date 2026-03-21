"""
Learning resources endpoint — returns recommended learning paths for missing skills.
GET /learning/resources?skills=Solidity,React,Docker
→ { resources: [{ skill, courses: [...], tutorials: [...], docs: [...] }] }
"""
import json
from typing import Any, Optional
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from services.analytics import generate_learning_roadmap, get_personalized_recommendations

router = APIRouter(prefix="/learning", tags=["learning"])

# Comprehensive resource database
LEARNING_RESOURCES: dict[str, dict[str, Any]] = {
    # Foundation Skills
    "HTML/CSS": {
        "difficulty": "Foundation",
        "category": "Frontend",
        "resources": {
            "courses": [
                {"name": "FreeCodeCamp HTML & CSS", "url": "https://www.freecodecamp.org/learn/responsive-web-design/", "type": "free", "duration": "300h"},
                {"name": "MDN Web Docs", "url": "https://developer.mozilla.org/en-US/docs/Web/HTML", "type": "free", "duration": "self-paced"},
            ],
            "tutorials": [
                {"name": "HTML5 Tutorial", "url": "https://www.w3schools.com/html/", "type": "interactive"},
                {"name": "CSS Tricks", "url": "https://css-tricks.com/", "type": "articles"},
            ],
            "projects": [
                "Build a personal portfolio",
                "Create a responsive landing page",
                "Style a blog with CSS Grid",
            ]
        }
    },
    
    "JavaScript": {
        "difficulty": "Foundation",
        "category": "Frontend",
        "resources": {
            "courses": [
                {"name": "FreeCodeCamp JavaScript", "url": "https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/", "type": "free", "duration": "300h"},
                {"name": "Eloquent JavaScript", "url": "https://eloquentjavascript.net/", "type": "free", "duration": "60h"},
            ],
            "tutorials": [
                {"name": "javascript.info", "url": "https://javascript.info/", "type": "interactive"},
                {"name": "Codecademy JavaScript", "url": "https://www.codecademy.com/learn/introduction-to-javascript", "type": "interactive"},
            ],
            "projects": [
                "Todo list app with vanilla JS",
                "Calculator with event handling",
                "Weather app with API calls",
            ]
        }
    },
    
    "Python": {
        "difficulty": "Foundation",
        "category": "Backend",
        "resources": {
            "courses": [
                {"name": "FreeCodeCamp Python", "url": "https://www.freecodecamp.org/learn/scientific-computing-with-python/", "type": "free", "duration": "280h"},
                {"name": "Python.org Tutorial", "url": "https://docs.python.org/3/tutorial/", "type": "free", "duration": "40h"},
            ],
            "tutorials": [
                {"name": "Real Python", "url": "https://realpython.com/", "type": "articles"},
                {"name": "Automate the Boring Stuff", "url": "https://automatetheboringstuff.com/", "type": "free-book"},
            ],
            "projects": [
                "Build a web scraper",
                "Create a CLI tool",
                "Build a data analysis script",
            ]
        }
    },
    
    "React": {
        "difficulty": "Intermediate",
        "category": "Frontend",
        "resources": {
            "courses": [
                {"name": "React Official Tutorial", "url": "https://react.dev/learn", "type": "free", "duration": "40h"},
                {"name": "FreeCodeCamp React", "url": "https://www.youtube.com/watch?v=bMknfKXIFIk", "type": "free", "duration": "11.5h"},
            ],
            "tutorials": [
                {"name": "React Docs", "url": "https://react.dev/reference/react", "type": "official"},
                {"name": "Modern React Tutorial", "url": "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf", "type": "youtube"},
            ],
            "projects": [
                "Build a todo app with hooks",
                "Create a news feed component",
                "Build a calculator app",
            ]
        }
    },
    
    "TypeScript": {
        "difficulty": "Intermediate",
        "category": "Frontend",
        "resources": {
            "courses": [
                {"name": "TypeScript Handbook", "url": "https://www.typescriptlang.org/docs/", "type": "free", "duration": "20h"},
                {"name": "Scrimba TypeScript", "url": "https://scrimba.com/learn/typescript", "type": "free", "duration": "3h"},
            ],
            "tutorials": [
                {"name": "TypeScript Deep Dive", "url": "https://basarat.gitbooks.io/typescript/", "type": "free-book"},
                {"name": "Official TS Playground", "url": "https://www.typescriptlang.org/play", "type": "interactive"},
            ],
            "projects": [
                "Migrate a JS project to TS",
                "Build a type-safe CLI tool",
                "Create utility types library",
            ]
        }
    },
    
    "Node.js": {
        "difficulty": "Intermediate",
        "category": "Backend",
        "resources": {
            "courses": [
                {"name": "Node.js Official Guide", "url": "https://nodejs.org/en/learn/", "type": "free", "duration": "30h"},
                {"name": "The Complete Node.js", "url": "https://www.udemy.com/course/the-complete-nodejs-developer-course-2/", "type": "paid", "duration": "34h"},
            ],
            "tutorials": [
                {"name": "Node.js Documentation", "url": "https://nodejs.org/docs/", "type": "official"},
                {"name": "Dev.to Node.js", "url": "https://dev.to/t/nodejs", "type": "community"},
            ],
            "projects": [
                "Build a REST API",
                "Create a file system CLI",
                "Build a real-time chat app",
            ]
        }
    },
    
    "Docker": {
        "difficulty": "Intermediate",
        "category": "DevOps",
        "resources": {
            "courses": [
                {"name": "Docker Official Getting Started", "url": "https://docs.docker.com/get-started/", "type": "free", "duration": "3h"},
                {"name": "FreeCodeCamp Docker", "url": "https://www.youtube.com/watch?v=pTFZFxM-Ng0", "type": "free", "duration": "4h"},
            ],
            "tutorials": [
                {"name": "Docker Docs", "url": "https://docs.docker.com/", "type": "official"},
                {"name": "Play with Docker", "url": "https://labs.play-with-docker.com/", "type": "interactive"},
            ],
            "projects": [
                "Containerize a Node.js app",
                "Create a multi-container app",
                "Build a Docker Compose project",
            ]
        }
    },
    
    # Advanced Skills
    "Solidity": {
        "difficulty": "Advanced",
        "category": "Blockchain",
        "resources": {
            "courses": [
                {"name": "CryptoZombies", "url": "https://cryptozombies.io/", "type": "free", "duration": "8h"},
                {"name": "Solidity Documentation", "url": "https://docs.soliditylang.org/", "type": "free", "duration": "40h"},
                {"name": "Udemy Solidity Masterclass", "url": "https://www.udemy.com/course/solidity-smart-contracts-programming/", "type": "paid", "duration": "45h"},
            ],
            "tutorials": [
                {"name": "OpenZeppelin Contracts", "url": "https://docs.openzeppelin.com/contracts/", "type": "reference"},
                {"name": "Hardhat Tutorial", "url": "https://hardhat.org/tutorial", "type": "official"},
            ],
            "projects": [
                "Build an ERC-20 token",
                "Create an NFT contract",
                "Build a simple DeFi protocol",
            ]
        }
    },
    
    "Smart Contracts": {
        "difficulty": "Advanced",
        "category": "Blockchain",
        "resources": {
            "courses": [
                {"name": "Ethereum Development Tutorial", "url": "https://ethereum.org/en/developers/tutorials/", "type": "free", "duration": "variable"},
                {"name": "A16z Crypto Bootcamp", "url": "https://a16zcrypto.com/portfolio/", "type": "free", "duration": "20h"},
            ],
            "tutorials": [
                {"name": "Etherscan Contracts", "url": "https://etherscan.io/", "type": "reference"},
                {"name": "DappTools", "url": "https://dapp.tools/", "type": "tools"},
            ],
            "projects": [
                "Build a staking contract",
                "Create a governance DAO",
                "Build a liquidity pool contract",
            ]
        }
    },
    
    # Web3/Blockchain
    "Web3.js": {
        "difficulty": "Advanced",
        "category": "Web3",
        "resources": {
            "courses": [
                {"name": "Web3.js Documentation", "url": "https://docs.web3js.org/", "type": "free", "duration": "variable"},
                {"name": "LearnWeb3 DAO", "url": "https://www.learnweb3.io/", "type": "free", "duration": "30h"},
            ],
            "tutorials": [
                {"name": "EthersJS Docs", "url": "https://docs.ethers.org/", "type": "official"},
                {"name": "Web3 Development Guide", "url": "https://ethereum.org/en/developers/", "type": "reference"},
            ],
            "projects": [
                "Build a Web3 wallet",
                "Create a dApp",
                "Build a Web3 dashboard",
            ]
        }
    },
    
    "IPFS": {
        "difficulty": "Advanced",
        "category": "Web3",
        "resources": {
            "courses": [
                {"name": "IPFS Documentation", "url": "https://docs.ipfs.io/", "type": "free", "duration": "20h"},
                {"name": "ProtoSchool Tutorials", "url": "https://proto.school/", "type": "interactive", "duration": "10h"},
            ],
            "tutorials": [
                {"name": "IPFS Basics", "url": "https://docs.ipfs.io/how-to/", "type": "official"},
                {"name": "Pinata IPFS", "url": "https://www.pinata.cloud/", "type": "service"},
            ],
            "projects": [
                "Store files on IPFS",
                "Build a decentralized blog",
                "Create an NFT storage system",
            ]
        }
    },
    
    "Stellar": {
        "difficulty": "Advanced",
        "category": "Blockchain",
        "resources": {
            "courses": [
                {"name": "Stellar Documentation", "url": "https://developers.stellar.org/", "type": "free", "duration": "25h"},
                {"name": "Build on Stellar", "url": "https://developers.stellar.org/docs/start/", "type": "free", "duration": "15h"},
            ],
            "tutorials": [
                {"name": "Stellar SDKs", "url": "https://developers.stellar.org/docs/tools-and-sdks/", "type": "official"},
                {"name": "Stellar Validators", "url": "https://validators.stellar.org/", "type": "reference"},
            ],
            "projects": [
                "Build a Stellar wallet",
                "Create a payment app",
                "Build a marketplace on Stellar",
            ]
        }
    },
    
    "Machine Learning": {
        "difficulty": "Advanced",
        "category": "AI/ML",
        "resources": {
            "courses": [
                {"name": "Andrew Ng ML Course", "url": "https://www.coursera.org/learn/machine-learning", "type": "free", "duration": "60h"},
                {"name": "Fast.ai", "url": "https://www.fast.ai/", "type": "free", "duration": "40h"},
            ],
            "tutorials": [
                {"name": "Scikit-learn", "url": "https://scikit-learn.org/stable/", "type": "official"},
                {"name": "ML Mastery", "url": "https://machinelearningmastery.com/", "type": "articles"},
            ],
            "projects": [
                "Build a classification model",
                "Create a recommendation system",
                "Build a chatbot",
            ]
        }
    },
    
    "Hardhat": {
        "difficulty": "Advanced",
        "category": "Blockchain",
        "resources": {
            "courses": [
                {"name": "Hardhat Documentation", "url": "https://hardhat.org/docs", "type": "free", "duration": "15h"},
                {"name": "Hardhat Tutorial", "url": "https://hardhat.org/tutorial", "type": "free", "duration": "3h"},
            ],
            "tutorials": [
                {"name": "Smart Contract Development", "url": "https://hardhat.org/hardhat-runner/docs/guides/project-setup", "type": "official"},
                {"name": "Testing Contracts", "url": "https://hardhat.org/hardhat-runner/docs/guides/test", "type": "official"},
            ],
            "projects": [
                "Deploy an ERC-20 token",
                "Create a full DeFi project",
                "Build an upgradeable contract",
            ]
        }
    },
}


class SkillResource(BaseModel):
    skill: str
    difficulty: str
    category: str
    resources: dict[str, Any]


class LearningPathResponse(BaseModel):
    skills: list[SkillResource]
    total_estimated_hours: int
    recommended_order: list[str]


@router.get("/resources")
async def get_learning_resources(skills: str = Query(..., description="Comma-separated list of skills")) -> dict[str, Any]:
    """
    Get learning resources for a list of skills.
    
    Query params:
    - skills: "Solidity,React,Docker"
    
    Returns:
    {
        "resources": [
            {
                "skill": "Solidity",
                "difficulty": "Advanced",
                "category": "Blockchain",
                "resources": {
                    "courses": [...],
                    "tutorials": [...],
                    "projects": [...]
                }
            }
        ],
        "total_estimated_hours": 60,
        "recommended_order": ["JavaScript", "React", "Web3.js"]
    }
    """
    skill_list = [s.strip() for s in skills.split(",") if s.strip()]
    
    resources = []
    total_hours = 0
    foundation_skills = []
    intermediate_skills = []
    advanced_skills = []
    
    for skill in skill_list:
        # Try exact match first, then case-insensitive
        resource = LEARNING_RESOURCES.get(skill)
        if not resource:
            # Try to find by partial match
            for key in LEARNING_RESOURCES:
                if key.lower() == skill.lower():
                    resource = LEARNING_RESOURCES[key]
                    skill = key  # Normalize to actual key
                    break
        
        if resource:
            skill_difficulty = resource.get("difficulty", "Intermediate")
            skill_category = resource.get("category", "General")
            
            resources.append({
                "skill": skill,
                "difficulty": skill_difficulty,
                "category": skill_category,
                "resources": resource.get("resources", {})
            })
            
            # Estimate hours from courses
            for course in resource.get("resources", {}).get("courses", []):
                duration = course.get("duration", "0h")
                if "h" in duration:
                    try:
                        hours = int(duration.replace("h", "").strip())
                        total_hours += hours
                    except ValueError:
                        pass
            
            # Categorize for recommended order
            if skill_difficulty == "Foundation":
                foundation_skills.append(skill)
            elif skill_difficulty == "Intermediate":
                intermediate_skills.append(skill)
            else:
                advanced_skills.append(skill)
    
    # Recommended order: Foundation → Intermediate → Advanced
    recommended_order = foundation_skills + intermediate_skills + advanced_skills
    
    return {
        "resources": resources,
        "total_estimated_hours": min(total_hours, 500),  # Cap at 500h
        "recommended_order": recommended_order,
        "summary": {
            "foundation_skills": foundation_skills,
            "intermediate_skills": intermediate_skills,
            "advanced_skills": advanced_skills,
        }
    }


@router.get("/roadmap/{skill}")
async def get_skill_roadmap(skill: str) -> dict[str, Any]:
    """
    Get a detailed learning roadmap for a specific skill.
    Includes prerequisites, learning path, and projects.
    """
    # Find the skill (case-insensitive)
    resource = LEARNING_RESOURCES.get(skill)
    if not resource:
        for key in LEARNING_RESOURCES:
            if key.lower() == skill.lower():
                resource = LEARNING_RESOURCES[key]
                skill = key
                break
    
    if not resource:
        return {
            "skill": skill,
            "found": False,
            "message": f"No learning resources found for {skill}"
        }
    
    return {
        "skill": skill,
        "found": True,
        "difficulty": resource.get("difficulty"),
        "category": resource.get("category"),
        "resources": resource.get("resources", {}),
        "study_tips": [
            "Start with official documentation",
            "Follow tutorials actively (type along, don't just watch)",
            "Build small projects to reinforce learning",
            "Join communities and ask questions",
            "Review and refactor your code regularly"
        ]
    }


class RoadmapStep(BaseModel):
    title: str
    duration: str
    type: str
    description: str


class LearningRoadmapResponse(BaseModel):
    skill: str
    target_level: int
    roadmap: list[RoadmapStep]
    estimated_total: str
    source: str


@router.get("/roadmap", response_model=LearningRoadmapResponse)
async def get_learning_roadmap(
    skill: str = Query(..., description="Skill to learn (e.g., Python, AI, Solidity)"),
    target: int = Query(default=60, ge=1, le=100, description="Target mastery level 1-100"),
) -> dict[str, Any]:
    """
    Generate a personalized learning roadmap using AI.
    
    Query params:
    - skill: "Python", "AI", "Solidity", etc.
    - target: Target mastery level (1-100), default 60
    
    Returns a structured micro-syllabus with 3-5 steps including:
    - title: Step name
    - duration: Estimated time (e.g., '2h', '4h', '1d')
    - type: 'Video', 'Project', or 'Doc'
    - description: Brief explanation
    
    Always returns valid data using fallback roadmaps if AI fails.
    """
    try:
        result = await generate_learning_roadmap(skill, target)
        return result
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate roadmap: {str(exc)}"
        )


class RecommendationItem(BaseModel):
    hackathon_id: str
    hackathon_title: str
    matching_skill: str
    reasoning_phrase: str
    potential_growth_score: int
    match_score: Optional[int] = None


class PersonalizedRecommendationsResponse(BaseModel):
    recommendations: list[RecommendationItem]
    generated_at: str
    source: str


@router.get("/recommendations", response_model=PersonalizedRecommendationsResponse)
async def get_recommendations(
    skills: str = Query(..., description="Comma-separated list of user skills"),
    hackathons_json: str = Query(..., description="JSON string of hackathons"),
) -> dict[str, Any]:
    """
    Get personalized hackathon recommendations based on user skills.
    
    Query params:
    - skills: "Python,React,Blockchain"
    - hackathons_json: JSON string of hackathon objects
    
    Returns top 3 recommendations with matching skills and reasoning.
    Cached for 1 hour to optimize API usage.
    """
    try:
        user_skills = [s.strip() for s in skills.split(",") if s.strip()]
        hackathons = json.loads(hackathons_json)
        
        result = await get_personalized_recommendations(user_skills, hackathons)
        return result
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid hackathons_json format")
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate recommendations: {str(exc)}"
        )
