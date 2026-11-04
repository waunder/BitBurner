"""Load tools/profile.py and tools/stage.py by path (`profile` is also a stdlib module name)."""
import importlib.util
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent.parent
REPO = TOOLS.parent
if str(TOOLS) not in sys.path:
    sys.path.append(str(TOOLS))  # appended: the stdlib `profile` must keep priority


def load(name: str, filename: str):
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, TOOLS / filename)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


profile = load("bb_profile", "profile.py")
stage = load("bb_stage", "stage.py")
