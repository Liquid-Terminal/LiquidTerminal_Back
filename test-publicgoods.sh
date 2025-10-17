#!/bin/bash

# Script de test pour les routes Public Goods
# Usage: ./test-publicgoods.sh

BASE_URL="http://localhost:3002"
API_URL="$BASE_URL/publicgoods"

# Couleurs pour l'output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher le résultat
print_test() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}TEST: $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ SUCCESS${NC}\n"
}

print_error() {
    echo -e "${RED}✗ ERROR: $1${NC}\n"
}

print_info() {
    echo -e "${YELLOW}ℹ INFO: $1${NC}"
}

# Variables pour stocker les IDs
PROJECT_ID=""
USER_TOKEN=""
MODERATOR_TOKEN=""

# ============================================
# TEST 1: GET /publicgoods (liste publique)
# ============================================
print_test "1. GET /publicgoods - Liste publique (APPROVED uniquement)"
print_info "Sans authentification, doit retourner seulement les projets APPROVED"

RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL?page=1&limit=10")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "$BODY" | jq '.'
    print_success
else
    print_error "Expected 200, got $HTTP_CODE"
    echo "$BODY"
fi

# ============================================
# TEST 2: GET /publicgoods?status=all (sans auth)
# ============================================
print_test "2. GET /publicgoods?status=all - Tous les projets"
print_info "Doit retourner tous les projets (PENDING, APPROVED, REJECTED)"

RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL?status=all&page=1&limit=10")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "$BODY" | jq '.'
    print_success
else
    print_error "Expected 200, got $HTTP_CODE"
    echo "$BODY"
fi

# ============================================
# TEST 3: GET /publicgoods avec filtres
# ============================================
print_test "3. GET /publicgoods avec filtres (search, category, developmentStatus)"

RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL?search=test&category=DeFi&developmentStatus=BETA")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "$BODY" | jq '.'
    print_success
else
    print_error "Expected 200, got $HTTP_CODE"
    echo "$BODY"
fi

# ============================================
# TEST 4: POST /publicgoods (SANS AUTH)
# ============================================
print_test "4. POST /publicgoods - Sans authentification (doit échouer)"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
    -F "name=Test Project" \
    -F "description=This is a test project with a very long description that meets the minimum requirement of 100 characters for validation purposes" \
    -F "githubUrl=https://github.com/test/repo" \
    -F "category=DeFi")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 401 ]; then
    echo "$BODY" | jq '.'
    print_success
else
    print_error "Expected 401, got $HTTP_CODE"
    echo "$BODY"
fi

# ============================================
# TEST 5: POST /publicgoods (AVEC AUTH - FAUX TOKEN)
# ============================================
print_test "5. POST /publicgoods - Avec faux token JWT (doit échouer)"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
    -H "Authorization: Bearer fake-token-123" \
    -F "name=Test Project" \
    -F "description=This is a test project with a very long description that meets the minimum requirement of 100 characters" \
    -F "githubUrl=https://github.com/test/repo" \
    -F "category=DeFi")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 401 ]; then
    echo "$BODY" | jq '.'
    print_success
else
    print_error "Expected 401, got $HTTP_CODE"
    echo "$BODY"
fi

# ============================================
# NOTE: Pour tester avec un vrai token JWT
# ============================================
print_info "Pour tester avec authentification, définir les variables:"
echo ""
echo -e "${YELLOW}export USER_TOKEN=\"your-privy-jwt-token\"${NC}"
echo -e "${YELLOW}export MODERATOR_TOKEN=\"your-moderator-jwt-token\"${NC}"
echo ""

if [ -n "$USER_TOKEN" ]; then
    # ============================================
    # TEST 6: POST /publicgoods (AVEC AUTH VALIDE)
    # ============================================
    print_test "6. POST /publicgoods - Créer un projet avec token valide"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
        -H "Authorization: Bearer $USER_TOKEN" \
        -F "name=Test Public Good Project" \
        -F "description=This is a comprehensive test project for the public goods feature. It aims to solve a critical problem in the HyperLiquid ecosystem by providing developers with better tools." \
        -F "githubUrl=https://github.com/test/publicgood" \
        -F "category=Developer Tools" \
        -F "problemSolved=Developers currently lack proper tooling to interact with HyperLiquid's advanced features efficiently." \
        -F "targetUsers=[\"developers\",\"traders\"]" \
        -F "hlIntegration=This project integrates directly with HyperLiquid's API to provide real-time data and advanced trading capabilities." \
        -F "developmentStatus=BETA" \
        -F "leadDeveloperName=John Doe" \
        -F "leadDeveloperContact=john@example.com" \
        -F "teamSize=SMALL" \
        -F "experienceLevel=INTERMEDIATE" \
        -F "technologies=[\"React\",\"TypeScript\",\"Node.js\"]" \
        -F "supportTypes=[\"PROMOTION\",\"FUNDING\"]" \
        -F "budgetRange=RANGE_15_30K" \
        -F "timeline=SIX_MONTHS")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 201 ]; then
        echo "$BODY" | jq '.'
        PROJECT_ID=$(echo "$BODY" | jq -r '.data.id')
        print_success
        print_info "Project created with ID: $PROJECT_ID"
    else
        print_error "Expected 201, got $HTTP_CODE"
        echo "$BODY"
    fi
    
    # ============================================
    # TEST 7: GET /publicgoods/:id
    # ============================================
    if [ -n "$PROJECT_ID" ]; then
        print_test "7. GET /publicgoods/$PROJECT_ID - Détail du projet"
        
        RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/$PROJECT_ID")
        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        BODY=$(echo "$RESPONSE" | head -n-1)
        
        if [ "$HTTP_CODE" -eq 200 ]; then
            echo "$BODY" | jq '.'
            print_success
        else
            print_error "Expected 200, got $HTTP_CODE"
            echo "$BODY"
        fi
    fi
    
    # ============================================
    # TEST 8: GET /publicgoods/my-submissions
    # ============================================
    print_test "8. GET /publicgoods/my-submissions - Mes projets"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/my-submissions" \
        -H "Authorization: Bearer $USER_TOKEN")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 200 ]; then
        echo "$BODY" | jq '.'
        print_success
    else
        print_error "Expected 200, got $HTTP_CODE"
        echo "$BODY"
    fi
    
    # ============================================
    # TEST 9: PUT /publicgoods/:id
    # ============================================
    if [ -n "$PROJECT_ID" ]; then
        print_test "9. PUT /publicgoods/$PROJECT_ID - Modifier le projet"
        
        RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$API_URL/$PROJECT_ID" \
            -H "Authorization: Bearer $USER_TOKEN" \
            -F "description=UPDATED: This is an updated comprehensive test project for the public goods feature. The description has been modified to reflect new changes." \
            -F "developmentStatus=PRODUCTION")
        
        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        BODY=$(echo "$RESPONSE" | head -n-1)
        
        if [ "$HTTP_CODE" -eq 200 ]; then
            echo "$BODY" | jq '.'
            print_success
        else
            print_error "Expected 200, got $HTTP_CODE"
            echo "$BODY"
        fi
    fi
    
    # ============================================
    # TEST 10: GET /publicgoods/pending (MODERATOR)
    # ============================================
    if [ -n "$MODERATOR_TOKEN" ]; then
        print_test "10. GET /publicgoods/pending - Liste PENDING (MODERATOR)"
        
        RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/pending" \
            -H "Authorization: Bearer $MODERATOR_TOKEN")
        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        BODY=$(echo "$RESPONSE" | head -n-1)
        
        if [ "$HTTP_CODE" -eq 200 ]; then
            echo "$BODY" | jq '.'
            print_success
        else
            print_error "Expected 200, got $HTTP_CODE"
            echo "$BODY"
        fi
        
        # ============================================
        # TEST 11: PATCH /publicgoods/:id/review (MODERATOR)
        # ============================================
        if [ -n "$PROJECT_ID" ]; then
            print_test "11. PATCH /publicgoods/$PROJECT_ID/review - Review APPROVED (MODERATOR)"
            
            RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/$PROJECT_ID/review" \
                -H "Authorization: Bearer $MODERATOR_TOKEN" \
                -H "Content-Type: application/json" \
                -d '{
                    "status": "APPROVED",
                    "reviewNotes": "Great project! Approved for public listing."
                }')
            
            HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
            BODY=$(echo "$RESPONSE" | head -n-1)
            
            if [ "$HTTP_CODE" -eq 200 ]; then
                echo "$BODY" | jq '.'
                print_success
            else
                print_error "Expected 200, got $HTTP_CODE"
                echo "$BODY"
            fi
        fi
    else
        print_info "Skipping MODERATOR tests (no MODERATOR_TOKEN)"
    fi
    
    # ============================================
    # TEST 12: DELETE /publicgoods/:id
    # ============================================
    if [ -n "$PROJECT_ID" ]; then
        print_test "12. DELETE /publicgoods/$PROJECT_ID - Supprimer le projet"
        
        RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/$PROJECT_ID" \
            -H "Authorization: Bearer $USER_TOKEN")
        
        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        BODY=$(echo "$RESPONSE" | head -n-1)
        
        if [ "$HTTP_CODE" -eq 200 ]; then
            echo "$BODY" | jq '.'
            print_success
        else
            print_error "Expected 200, got $HTTP_CODE"
            echo "$BODY"
        fi
    fi
    
else
    print_info "Skipping authenticated tests (no USER_TOKEN)"
fi

# ============================================
# TEST 13: GET /publicgoods/:id - Not Found
# ============================================
print_test "13. GET /publicgoods/999999 - Projet inexistant (404)"

RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/999999")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 404 ]; then
    echo "$BODY" | jq '.'
    print_success
else
    print_error "Expected 404, got $HTTP_CODE"
    echo "$BODY"
fi

# ============================================
# TEST 14: POST avec validation errors
# ============================================
print_test "14. POST /publicgoods - Validation errors (description trop courte)"

if [ -n "$USER_TOKEN" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
        -H "Authorization: Bearer $USER_TOKEN" \
        -F "name=Test" \
        -F "description=Short" \
        -F "githubUrl=https://github.com/test/repo")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" -eq 400 ]; then
        echo "$BODY" | jq '.'
        print_success
    else
        print_error "Expected 400, got $HTTP_CODE"
        echo "$BODY"
    fi
else
    print_info "Skipping (no USER_TOKEN)"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Tests terminés !${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
print_info "Pour tester avec authentification complète:"
echo -e "1. Obtenir un token Privy JWT (USER)"
echo -e "2. Obtenir un token Privy JWT (MODERATOR)"
echo -e "3. Export USER_TOKEN=\"...\" && export MODERATOR_TOKEN=\"...\""
echo -e "4. Relancer ce script"

