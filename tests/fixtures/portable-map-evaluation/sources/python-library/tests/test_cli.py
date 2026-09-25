import io
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from harborlog.cli import main


class CliTests(unittest.TestCase):
    def test_policy_command_reads_toml_configuration(self):
        config = Path(__file__).parents[1] / "config" / "test.toml"
        output = io.StringIO()
        with redirect_stdout(output):
            result = main(["--config", str(config), "policy"])

        self.assertEqual(result, 0)
        self.assertIn("max-open-days: 7", output.getvalue())
        self.assertIn("standard-due-days: 14", output.getvalue())


if __name__ == "__main__":
    unittest.main()
