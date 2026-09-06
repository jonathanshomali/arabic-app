"""Strict compatibility loading for the pinned Sofelia checkpoint.

The checkpoint uses DataParallel names, modern parametrized weight norm, and
non-affine instance normalization. Kokoro 0.9.4 expects legacy weight norm and
affine instance normalization. Its permissive fallback silently skips weights.
Never generate speech until every module passes strict loading here.
"""
import torch
from kokoro import KModel


def normalize_state(state):
    result = {}
    for name, tensor in state.items():
        name = name.removeprefix("module.")
        name = name.replace(".parametrizations.weight.original0", ".weight_g")
        name = name.replace(".parametrizations.weight.original1", ".weight_v")
        if name in result:
            raise ValueError(f"Duplicate checkpoint key after conversion: {name}")
        result[name] = tensor
    return result


def load_model(config_path, checkpoint_path):
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=True)
    expected = {"bert", "bert_encoder", "predictor", "text_encoder", "decoder"}
    if set(checkpoint) != expected:
        raise ValueError("Unexpected checkpoint components")
    model = KModel(repo_id="hexgrad/Kokoro-82M", config=config_path,
                   model=checkpoint_path).cpu()
    for component, raw_state in checkpoint.items():
        load_component(getattr(model, component), raw_state)
    return model.eval()


def load_component(module, raw_state):
    state = normalize_state(raw_state)
    # Match only the checkpoint's absent InstanceNorm affine transforms.
    # Do not accept arbitrary missing learned parameters or unexpected keys.
    for name, layer in module.named_modules():
        if isinstance(layer, torch.nn.InstanceNorm1d):
            if f"{name}.weight" not in state and f"{name}.bias" not in state:
                layer.affine = False
                layer.register_parameter("weight", None)
                layer.register_parameter("bias", None)
    module.load_state_dict(state, strict=True)
