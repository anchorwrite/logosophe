#!/bin/bash

case "$1" in
  "worker")
    echo "Deploying worker..."
    yarn workspace worker deploy
    ;;
  "email")
    echo "Deploying email worker..."
    yarn workspace email-worker deploy
    ;;
  "all")
    echo "Deploying all workers..."
    yarn workspace worker deploy
    yarn workspace email-worker deploy
    ;;
  *)
    echo "Usage: $0 {worker|email|all}"
    echo "  worker - Deploy main worker"
    echo "  email  - Deploy email worker"
    echo "  all    - Deploy all workers"
    exit 1
    ;;
esac 