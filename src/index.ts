import fs from "node:fs";
import path from "node:path";
import * as glob from "glob";
import mime from "mime-types";
import { send } from "vite";
import type { Plugin } from "vite";

type ListenDir = string;

const viteAdditionalPublic = (targetDir: ListenDir): Plugin => {
  let staticFiles: Record<string, Buffer> = {};
  const addStaticFiles = () => {
    staticFiles = {};
    const listenFiles = glob.sync(path.join(targetDir, "/**/*"), {
      nodir: true,
    });
    for (const file of listenFiles) {
      const resolveFile = path.resolve(file);
      staticFiles[resolveFile] = fs.readFileSync(resolveFile);
    }
  };
  addStaticFiles();
  return {
    apply: "serve",
    name: "vite-server-static",
    handleHotUpdate: () => {
      addStaticFiles();
    },
    options: (conf) => {
      addStaticFiles();
    },
    resolveId: (id) => {
      if (/\/{|common|assets|favicon|image|}\//.test(id)) {
        const requestId = id.split("?")[0].split("#")[0];
        const resolveId = path.resolve(path.join(targetDir, requestId));
        return resolveId;
      }
    },
    load: (id) => {
      if (/\/{|common|assets|favicon|image|}/.test(id)) {
        return fs.readFileSync(id, "utf-8");
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && targetDir) {
          const requestURL = req.url.split("?")[0].split("#")[0];
          const requestFullFilePath = path.join(
            path.resolve(targetDir),
            requestURL,
          );
          if (staticFiles[requestFullFilePath]) {
            const type = mime.lookup(requestURL);
            return send(
              req,
              res,
              staticFiles[requestFullFilePath],
              String(type),
              {},
            );
          }
          return next();
        }
        next();
      });
    },
  };
};

export default viteAdditionalPublic;
