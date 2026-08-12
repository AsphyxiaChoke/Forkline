"use strict";

function createRepositoryOpenCoordinator(options = {}) {
  const resolveRepository = options.resolveRepository;
  const deliver = options.deliver;
  if (typeof resolveRepository !== "function" || typeof deliver !== "function") {
    throw new TypeError("Repository open coordinator requires resolve and deliver handlers");
  }

  let rendererReady = false;
  let pendingRepository = "";

  function flush() {
    if (!rendererReady || !pendingRepository) return "";
    const repository = pendingRepository;
    if (deliver(repository) === false) return "";
    pendingRepository = "";
    return repository;
  }

  return {
    getPendingRepository: () => pendingRepository,
    request(argv, appRoot) {
      const repository = resolveRepository(argv, appRoot);
      if (!repository) return "";
      pendingRepository = repository;
      flush();
      return repository;
    },
    setRendererReady(value) {
      rendererReady = Boolean(value);
      return flush();
    },
  };
}

module.exports = { createRepositoryOpenCoordinator };
