FROM node:24-alpine AS build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_FRIEBASE_API_KEY
ARG VITE_RAZORPAY_KEY_ID
ARG VITE_SERVER_URL=""

ENV VITE_FRIEBASE_API_KEY=$VITE_FRIEBASE_API_KEY
ENV VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID
ENV VITE_SERVER_URL=$VITE_SERVER_URL

RUN npm run build

FROM nginx:alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80