from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from datetime import datetime
from database import get_collection
from auth_utils import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/register", summary="Register a new user")
async def register(body: RegisterRequest):
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    users = await get_collection("users")
    existing = await users.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    user_doc = {
        "email": body.email,
        "name": body.name or body.email.split("@")[0],
        "hashed_password": hash_password(body.password),
        "created_at": datetime.utcnow().isoformat(),
        "is_active": True,
    }
    result = await users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    token = create_access_token(user_id=user_id, email=body.email)
    return AuthResponse(
        access_token=token,
        user={"id": user_id, "email": body.email, "name": user_doc["name"]},
    )


@router.post("/login", summary="Login and get access token")
async def login(body: LoginRequest):
    users = await get_collection("users")
    user = await users.find_one({"email": body.email})

    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is inactive.")

    user_id = str(user["_id"])
    token = create_access_token(user_id=user_id, email=user["email"])
    return AuthResponse(
        access_token=token,
        user={"id": user_id, "email": user["email"], "name": user.get("name", "")},
    )


@router.get("/me", summary="Get current user")
async def me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user.get("name", ""),
        "created_at": current_user.get("created_at"),
    }
