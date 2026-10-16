// import { searchtool } from "../config/tavily.js"

// export const searchAgent = async (state) => {
//     try {
//         const results = await searchtool.invoke({
//             query: state.prompt
//          })

//          console.log(results);

//          return{
//             ...state,
//             searchResults: results,
//             images: results.images,
//          }
//     } catch (error) {
//         console.log("Error in Search Agent: ", error);
//         return{
//             ...state,
//             searchResults: "Sorry, Something went wrong I countn't Search for what you ask",
//             images: [],
//          }
//     }
// }
import { deductCredits } from "../utils/deductCredits.js";
import { checkLimit } from "../config/agentLimit.js";

const SEARXNG_URL = process.env.SEARXNG_URL || "http://localhost:8080";

// docker run --hostname=326ddeb29af9 --env=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin --env=SSL_CERT_DIR=/etc/ssl/certs --env=SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt --env=HISTFILE=/dev/null --env=__SEARXNG_CONFIG_PATH=/etc/searxng --env=__SEARXNG_DATA_PATH=/var/cache/searxng --env=__SEARXNG_VERSION=2026.10.7-6671d89be --env=__SEARXNG_SETTINGS_PATH=/etc/searxng/settings.yml --env=GRANIAN_PROCESS_NAME=searxng --env=GRANIAN_INTERFACE=wsgi --env=GRANIAN_HOST=:: --env=GRANIAN_PORT=8080 --env=GRANIAN_WEBSOCKETS=false --env=GRANIAN_BLOCKING_THREADS=4 --env=GRANIAN_WORKERS_KILL_TIMEOUT=30s --env=GRANIAN_BLOCKING_THREADS_IDLE_TIMEOUT=5m --volume=D:\AI MERN PROJECT\CortexAI\backend\settings.yml:/etc/searxng/settings.yml:ro --volume=/etc/searxng --volume=/var/cache/searxng --network=bridge --workdir=/usr/local/searxng -p 8080:8080 --restart=no --label='org.opencontainers.image.created=2026-10-07T09:22:12Z' --label='org.opencontainers.image.description=SearXNG is a metasearch engine. Users are neither tracked nor profiled.' --label='org.opencontainers.image.documentation=https://docs.searxng.org/admin/installation-docker' --label='org.opencontainers.image.licenses=AGPL-3.0-or-later' --label='org.opencontainers.image.revision=6671d89bede8c9fc108b17bb98916170f5657650' --label='org.opencontainers.image.source=https://github.com/searxng/searxng' --label='org.opencontainers.image.title=SearXNG' --label='org.opencontainers.image.url=https://searxng.org' --label='org.opencontainers.image.version=2026.10.7-6671d89be' --log-driver=local --runtime=runc -d searxng/searxng

export const searchAgent = async (state) => {
  try {
    await checkLimit(state.userId, "search");

    const query = state.prompt;

    const [webResponse, imageResponse] = await Promise.all([
      fetch(`${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json`),
      fetch(
        `${SEARXNG_URL}/search?q=${encodeURIComponent(query)}&categories=images&format=json`,
      ),
    ]);

    if (!webResponse.ok || !imageResponse.ok) {
      throw new Error("SearXNG request failed");
    }

    const [webData, imageData] = await Promise.all([
      webResponse.json(),
      imageResponse.json(),
    ]);

    // Extract web search results
    const searchResults = (webData.results ?? []).map((item) => ({
      title: item.title,
      content: item.content,
      url: item.url,
    }));

    // Extract image search results
    const images = (imageData.results ?? [])
      .filter((item) => item.img_src)
      .map((item) => item.thumbnail_src || item.img_src)
      .slice(0, 10);

    console.log("Web results:", searchResults);
    console.log("Image results:", images);

    await deductCredits({
      userId: state.userId,
      agent: "search",
    });

    return {
      ...state,
      searchResults,
      images,
    };
  } catch (error) {
    console.error("Error in Search Agent:", error);

    return {
      ...state,
      searchResults:[],
      images:[],
      aiResponse:
        error?.data?.message || "Sorry, something went wrong while searching.",
    };
  }
};
