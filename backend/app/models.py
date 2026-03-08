from pydantic import BaseModel


class Network(BaseModel):
    id: str
    name: str
    vlan_id: int | None = None
    subnet: str | None = None


class Zone(BaseModel):
    id: str
    name: str
    networks: list[Network] = []


class Rule(BaseModel):
    id: str
    name: str
    description: str = ""
    enabled: bool
    action: str  # "ALLOW", "BLOCK", "REJECT"
    source_zone_id: str
    destination_zone_id: str
    protocol: str = "all"
    port_ranges: list[str] = []
    ip_ranges: list[str] = []
    index: int = 0
    predefined: bool = False


class ZonePair(BaseModel):
    source_zone_id: str
    destination_zone_id: str
    rules: list[Rule]
    allow_count: int
    block_count: int
