from app.main import app
from fastapi.routing import APIRoute
from collections import defaultdict

routes_dict = defaultdict(list)
for route in app.routes:
    if isinstance(route, APIRoute):
        for method in route.methods:
            routes_dict[(method, route.path)].append(route.name)

redundant = {k: v for k, v in routes_dict.items() if len(v) > 1}
if redundant:
    print("Found redundant endpoints:")
    for (method, path), names in redundant.items():
        print(f"{method} {path} -> {names}")
else:
    print("No redundant endpoints found.")
