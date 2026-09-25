package com.blueprint.fixture.lockers.application;

import java.nio.file.Path;
import java.util.List;

public interface ManifestReader {
    List<ManifestLine> read(Path path);
}
