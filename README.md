# NoBound AI

**NoBound AI** is a multimodal AI assistant and workspace built around a
React frontend and a modular Node.js microservices backend. It brings AI
chat, coding assistance, web search, document workflows, image
generation, and model access into one application.

> Former project name: **CortexAI**\
> Repository: `GreeshmanDama/NoBoundAI-AI-Powered-Multimodal-Assistant`

------------------------------------------------------------------------

## Table of contents

-   [Overview](#overview)
-   [Features](#features)
-   [Architecture](#architecture)
-   [Technology stack](#technology-stack)
-   [Project structure](#project-structure)
-   [Local development](#local-development)
-   [Environment configuration](#environment-configuration)
-   [Service ports](#service-ports)
-   [Infrastructure](#infrastructure)
-   [Docker](#docker)
-   [Deployment](#deployment)
-   [Security notes](#security-notes)

## Overview

NoBound AI is designed as an extensible AI workspace. The frontend
communicates with a central API gateway, which routes requests to
dedicated backend services. The agent service coordinates AI features
and connects to the configured model provider and supporting tools.

The application uses a microservices layout so authentication,
conversations, agent workflows, and billing can be developed and
deployed independently.

## Features

-   **AI chat** --- conversational AI experience with conversation
    history.
-   **Model access and routing** --- integrates with FreeLLMAPI through
    an OpenAI-compatible API.
-   **Coding assistance** --- AI-assisted code generation and problem
    solving.
-   **Web search** --- search-assisted responses using SearXNG.
-   **Document workflows** --- PDF-related generation and document
    analysis capabilities.
-   **Image generation** --- image-generation workflow through the
    agent.
-   **Vision support** --- image-aware AI workflows.
-   **Presentation generation** --- PowerPoint generation workflows.
-   **PDF storage** --- Cloudinary integration for generated PDF assets.
-   **Authentication** --- Firebase-based authentication with backend
    user protection.
-   **Billing** --- credit/plan management and Razorpay integration.
-   **Conversation management** --- create, select, and delete
    conversations.
-   **Vector database integration** --- ChromaDB is included in the
    supporting infrastructure for vector-backed workflows.

Feature availability depends on the configured model provider, API
credentials, and supporting services.

## Architecture

``` text
                         ┌─────────────────────┐
                         │    React + Vite      │
                         │      Frontend        │
                         └──────────┬──────────┘
                                    │ HTTP/API
                         ┌──────────▼──────────┐
                         │     API Gateway     │
                         │       :8000         │
                         └─┬────┬────┬────┬────┘
                           │    │    │    │
                ┌──────────┘    │    │    └──────────┐
                ▼               ▼    ▼               ▼
          ┌──────────┐    ┌────────┐ ┌────────┐  ┌──────────┐
          │   Auth   │    │  Chat  │ │ Agent  │  │ Billing  │
          │  :8001   │    │ :8002  │ │ :8003  │  │  :8004   │
          └──────────┘    └────────┘ └───┬────┘  └──────────┘
                                        │
                   ┌────────────────────┼────────────────────┐
                   ▼                    ▼                    ▼
             FreeLLMAPI             SearXNG              ChromaDB
               :3001                :8080                 :8000

                         Supporting services
                         MongoDB Atlas · Redis
                         Cloudinary · Firebase
```

### Backend services

  Service     Default port Responsibility
  --------- -------------- ------------------------------------------------
  Gateway           `8000` Main API entry point and request routing
  Auth              `8001` Authentication-related backend operations
  Chat              `8002` Conversation and chat operations
  Agent             `8003` AI agent workflows and tool orchestration
  Billing           `8004` Plans, credits, and payment-related operations

The frontend is a Vite application. In the Docker deployment, it is
served through Nginx on port `80`.

## Technology stack

### Frontend

-   React
-   Vite
-   Redux
-   Tailwind CSS
-   Axios
-   Lucide React
-   Framer Motion

### Backend and AI

-   Node.js
-   Express
-   LangChain / LangGraph
-   OpenAI-compatible client integration
-   FreeLLMAPI for model access and routing

### Data and infrastructure

-   MongoDB Atlas
-   Redis
-   ChromaDB
-   SearXNG
-   Cloudinary
-   Firebase Authentication
-   Razorpay

### Deployment

-   Docker
-   Docker Compose for supporting infrastructure
-   Nginx for frontend serving
-   AWS EC2

## Project structure

The repository is organized as a frontend and backend monorepo. The
backend contains the independently deployable services and their
Dockerfiles.

``` text
NoBoundAI/
├── frontend/
│   ├── public/
│   │   └── noboundglobe.svg
│   ├── src/
│   ├── Dockerfile
│   └── package.json
│
├── backend/
│   ├── gateway/
│   │   └── Dockerfile
│   ├── auth/
│   │   └── Dockerfile
│   ├── chat/
│   │   └── Dockerfile
│   ├── agent/
│   │   └── Dockerfile
│   ├── billing/
│   │   └── Dockerfile
│   └── compose.yml
│
└── README.md
```

This is a high-level layout; individual service folders may contain
additional source, configuration, and support files.

## Local development

### Prerequisites

Install the following before starting:

-   Node.js and npm
-   Docker Desktop (or Docker Engine with the Compose plugin)
-   Access to the required external services and API credentials

### 1. Clone the repository

``` bash
git clone https://github.com/GreeshmanDama/NoBoundAI-AI-Powered-Multimodal-Assistant.git
cd NoBoundAI-AI-Powered-Multimodal-Assistant
```

### 2. Install frontend dependencies

``` bash
cd frontend
npm install
```

Start the Vite development server using the script configured in
`frontend/package.json` (commonly):

``` bash
npm run dev
```

### 3. Configure backend services

Create the required environment files for the backend services using the
variable names expected by each service's source code. Configure the
gateway's service URLs to point to the correct local service ports.

Do not copy production secrets into source control.

### 4. Start supporting infrastructure

The backend Compose file is named `compose.yml`:

``` bash
cd backend
docker compose -f compose.yml up -d
```

This Compose stack is used for supporting components such as FreeLLMAPI,
Redis, ChromaDB, and SearXNG. Check the Compose file for the exact
service definitions, volumes, and port mappings in your checkout.

### 5. Start the backend services

Each backend service has its own Dockerfile and can be run
independently. For local Node.js development, open a terminal in each
service directory, install its dependencies, and use the
development/start script defined in that service's `package.json`.

Start the supporting services before starting backend services that
depend on them. Start the gateway after its target services are
available.

> The exact npm script names and environment-file locations are
> service-specific; use the scripts and configuration in the checked-out
> repository rather than assuming a single root-level command.

## Environment configuration

The application depends on credentials and connection settings for its
integrations. Exact variable names are defined by the individual
services and their environment files.

Typical configuration categories include:

  -----------------------------------------------------------------------
  Configuration                       Used for
  ----------------------------------- -----------------------------------
  Service port                        Port each Node.js service listens
                                      on

  Gateway target URLs                 Internal URLs for auth, chat,
                                      agent, and billing

  MongoDB connection string           Database access

  Redis URL/host/port                 Cache and queue-related operations

  FreeLLMAPI base URL and API key     OpenAI-compatible model requests

  Firebase configuration/service      Authentication verification
  credentials                         

  Cloudinary credentials              PDF and asset storage

  Razorpay key ID and secret          Payment integration

  SearXNG URL                         Web-search requests

  ChromaDB URL                        Vector database connectivity
  -----------------------------------------------------------------------

Use the repository's existing `.env.example` files or service
configuration as the source of truth for exact variable names and
required values. Never commit `.env` files, private keys,
service-account JSON files, payment secrets, or provider API keys.

## Service ports

  Component                        Port
  ---------------------------- --------
  Frontend (Nginx container)       `80`
  FreeLLMAPI                     `3001`
  API Gateway                    `8000`
  Auth service                   `8001`
  Chat service                   `8002`
  Agent service                  `8003`
  Billing service                `8004`
  Redis                          `6379`
  ChromaDB container             `8000`
  SearXNG                        `8080`

The ChromaDB container's internal port `8000` is separate from the
host-side port mapping. Check `backend/compose.yml` for the actual host
port (the development deployment has used host port `8006`).

Avoid exposing internal databases, caches, model-provider dashboards, or
microservice ports directly to the public internet. Route public
application traffic through the intended gateway/reverse proxy.

## Infrastructure

The supporting infrastructure used by the application includes:

-   **FreeLLMAPI** --- provides an OpenAI-compatible endpoint for model
    requests. The application uses its `/v1/chat/completions` API.
-   **Redis** --- provides shared in-memory data services for backend
    workflows.
-   **ChromaDB** --- vector database component for vector-backed
    functionality.
-   **SearXNG** --- self-hosted metasearch service used by web-search
    workflows.
-   **MongoDB Atlas** --- managed database.
-   **Cloudinary** --- stores generated document assets.
-   **Firebase** --- authentication integration.
-   **Razorpay** --- payment integration.

## Docker

The frontend and backend microservices have individual Dockerfiles.
Supporting infrastructure is defined in `backend/compose.yml`.

Start the supporting Compose stack:

``` bash
cd backend
docker compose -f compose.yml up -d
```

Stop it:

``` bash
docker compose -f compose.yml down
```

To inspect running containers:

``` bash
docker ps
```

To inspect logs for a container:

``` bash
docker logs -f <container-name>
```

Build and run each application service using its own Dockerfile and the
build context expected by that Dockerfile. Check the deployment
configuration in the repository before building; do not assume every
service shares the same build context.

## Deployment

The project has been deployed/tested on AWS EC2 using Docker-based
services. The deployed layout includes:

-   Nginx serving the frontend on port `80`.
-   The API gateway and the four backend microservices.
-   FreeLLMAPI, Redis, ChromaDB, and SearXNG.
-   External integrations such as MongoDB Atlas, Firebase, Cloudinary,
    and Razorpay.

For a production deployment:

1.  Configure all required environment variables and external
    credentials.
2.  Ensure service-to-service URLs use reachable private/container
    network addresses.
3.  Persist data for stateful containers using Docker volumes or an
    appropriate managed service.
4.  Put the public frontend/API entry point behind a reverse proxy and
    HTTPS.
5.  Restrict security-group access to only the ports that must be
    public.
6.  Verify health checks, logs, database connectivity, and
    model-provider requests after deployment.

Deployment hostnames, IP addresses, credentials, and
environment-specific values are intentionally not included in this
README.

## Security notes

-   Keep all secrets in environment variables or a secure secrets
    manager.
-   Do not commit `.env`, Firebase private keys, service-account files,
    or payment credentials.
-   Restrict database, Redis, ChromaDB, SearXNG, and internal
    microservice access.
-   Use HTTPS for public traffic.
-   Rotate any credential that has been accidentally committed or
    exposed.

------------------------------------------------------------------------

## License

Add the license and copyright details applicable to this repository
before distributing the project.
