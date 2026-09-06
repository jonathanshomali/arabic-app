import unittest
import torch
from model_loader import load_component, normalize_state


class CheckpointCompatibilityTests(unittest.TestCase):
    def setUp(self):
        torch.manual_seed(42)
        self.source = torch.nn.Sequential(
            torch.nn.utils.parametrizations.weight_norm(torch.nn.Conv1d(2, 3, 3)),
            torch.nn.InstanceNorm1d(3, affine=False),
        )
        self.target = torch.nn.Sequential(
            torch.nn.utils.weight_norm(torch.nn.Conv1d(2, 3, 3)),
            torch.nn.InstanceNorm1d(3, affine=True),
        )
        self.checkpoint = {"module." + k: v for k, v in self.source.state_dict().items()}

    def test_converted_model_matches_trained_model_output(self):
        x = torch.randn(1, 2, 40)
        self.assertFalse(torch.allclose(self.source(x), self.target(x)))
        load_component(self.target, self.checkpoint)
        torch.testing.assert_close(self.source(x), self.target(x))

    def test_missing_speech_weight_is_fatal(self):
        del self.checkpoint["module.0.parametrizations.weight.original1"]
        with self.assertRaises(RuntimeError):
            load_component(self.target, self.checkpoint)

    def test_unexpected_weight_is_fatal(self):
        self.checkpoint["module.unrecognized"] = torch.zeros(1)
        with self.assertRaises(RuntimeError):
            load_component(self.target, self.checkpoint)

    def test_wrong_shape_is_fatal(self):
        self.checkpoint["module.0.bias"] = torch.zeros(10)
        with self.assertRaises(RuntimeError):
            load_component(self.target, self.checkpoint)

    def test_name_collision_is_fatal(self):
        with self.assertRaises(ValueError):
            normalize_state({"module.a": torch.zeros(1), "a": torch.ones(1)})


if __name__ == "__main__":
    unittest.main()
