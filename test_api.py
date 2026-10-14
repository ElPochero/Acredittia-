import sys
sys.path.append("/app")
from app.services.auth import encode_token
import uuid, requests
token = encode_token(uuid.UUID("50c4f58c-74e1-486e-a38c-b86920ba0ca5"))
res = requests.get("http://localhost:8000/api/v1/contratos", headers={"Authorization": f"Bearer {token}", "X-Company-Id": "e8bf99f2-eec1-4320-80f0-19b36b1c481e"})
print(res.json())
