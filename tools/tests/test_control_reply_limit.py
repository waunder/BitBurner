import asyncio
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import bb_remote  # noqa: E402


class ControlReplyLimit(unittest.TestCase):
    def test_file_list_larger_than_request_limit_is_read(self):
        names = ["x" * 40] * 60_000  # about 2.6MB, over CONTROL_MESSAGE_LIMIT

        async def run():
            async def serve(reader, writer):
                await reader.readline()
                writer.write((json.dumps({"ok": True, "result": names}) + "\n").encode())
                await writer.drain()
                writer.close()

            server = await asyncio.start_server(serve, "127.0.0.1", 0)
            try:
                return await bb_remote._ctl_call(server.sockets[0].getsockname()[1], {"cmd": "list"})
            finally:
                server.close()

        reply = asyncio.run(run())
        self.assertEqual(reply, {"ok": True, "result": names})


if __name__ == "__main__":
    unittest.main()
