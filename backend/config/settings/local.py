import os
import environ

# Read .env from the backend/ directory (two levels up from this settings file)
_env_file = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
environ.Env.read_env(os.path.abspath(_env_file))  # reads .env before base settings load

from .base import *

env = environ.Env()

DEBUG = True
SECRET_KEY = env("SECRET_KEY", default="local-dev-secret-key-not-for-production")
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
CORS_ALLOW_ALL_ORIGINS = True
