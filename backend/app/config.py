from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    unifi_url: str = ""
    unifi_site: str = "default"
    unifi_user: str = ""
    unifi_pass: str = ""
    unifi_verify_ssl: bool = False

    model_config = {"env_file": ".env"}


settings = Settings()
