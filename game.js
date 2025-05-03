// Radioactive Package Game - JavaScript version
// Translated from Python/Pygame

// Global variables
let canvas, ctx;
let player, playerSprite;
let obstacleGroup = [];
let skyImage, groundImage, symbolImage;
let keyImages = [];
let gameFont;
let testFont;

// Game state
let gameActive = false;
let paused = false;
let gameOver = false;
let score = 0;
let backgroundNum = roundToDecimal(Math.random() * 0.07, 2);
let highlightedKey = null;
let collidedObstacle = null;
let correctKey = null;
let resultMessage = null;
let showResult = false;
let resultTimer = 0;

// Player info
let playerName = "";
let playerEmail = "";
let playerProfession = "";
let playerInfoCollected = false;
let sessionCount = 1;
let gameStartTime = 0;
let hasSentStart = false;

// Timing
let lastTime = 0;
let obstacleTimerInterval = 1500;
let lastObstacleTime = 0;

// Audio
let bgMusic;

// Helper function to generate random number within range
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to generate random float within range
function uniform(min, max) {
    return Math.random() * (max - min) + min;
}

// Helper function to round decimal
function roundToDecimal(value, decimalPlaces) {
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(value * factor) / factor;
}

// Mock xAPI implementation
function sendXapiStatement(options) {
    console.log("xAPI statement would be sent:", options);
}

// Player class with dynamically settable radiation reading
class Player {
    constructor() {
        this.baseImage = new Image();
        this.baseImage.src = "graphics/easyGeiger";
        this.image = this.baseImage;
        this.rect = {
            x: 150,
            y: 500,
            width: 100,
            height: 150
        };
        this.currentReading = null;
    }

    setReading(value) {
        this.currentReading = value;
        // Create a copy of base image by drawing it to an off-screen canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.baseImage.width;
        tempCanvas.height = this.baseImage.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw the base image
        tempCtx.drawImage(this.baseImage, 0, 0);
        
        // Add text
        tempCtx.font = '30px Pixeltype, Arial';
        tempCtx.fillStyle = 'red';
        tempCtx.fillText(`${value.toFixed(2)}`, 30, 100);
        
        // Create a new image from the canvas
        this.image = new Image();
        this.image.src = tempCanvas.toDataURL();
    }

    draw(ctx) {
        ctx.drawImage(this.image, this.rect.x - this.rect.width/2, this.rect.y - this.rect.height);
    }

    update() {
        // No movement logic needed for the player in this game
    }
}

// Obstacle class
class Obstacle {
    constructor() {
        this.image = new Image();
        this.image.src = 'graphics/radpack.png';
        this.rect = {
            x: randInt(1150, 1250),
            y: 500,
            width: 80,
            height: 100
        };
        this.tiNum = roundToDecimal(uniform(0, 10), 1);
        this.surfaceNum = null;
    }

    update() {
        this.rect.x -= 6;
        this.destroy();
    }

    destroy() {
        if (this.rect.x <= -100) {
            // Remove from obstacle group
            const index = obstacleGroup.indexOf(this);
            if (index > -1) {
                obstacleGroup.splice(index, 1);
            }
        }
    }

    draw(ctx) {
        ctx.drawImage(this.image, this.rect.x - this.rect.width/2, this.rect.y - this.rect.height);
    }
}

// Display score
function displayScore(score) {
    ctx.font = '45px Pixeltype, Arial';
    ctx.fillStyle = 'rgb(64, 64, 64)';
    const text = `Score: ${score}`;
    const textWidth = ctx.measureText(text).width;
    ctx.fillText(text, 600 - textWidth/2, 50);
}

// Display TI Index
function displayTiIndex(tiValue) {
    ctx.font = '45px Pixeltype, Arial';
    ctx.fillStyle = 'rgb(255, 0, 0)';
    
    // TI Index
    const tiText = `TI Index: ${tiValue.toFixed(2)} mR/hr`;
    const tiTextWidth = ctx.measureText(tiText).width;
    ctx.fillText(tiText, 1150 - tiTextWidth, 20 + 45);
    
    // Background radiation
    const bgText = `Background: ${backgroundNum.toFixed(2)} mR/hr`;
    const bgTextWidth = ctx.measureText(bgText).width;
    ctx.fillText(bgText, 1150 - bgTextWidth, 20 + 45 + 55);
}

// Draw game elements
function drawGame() {
    ctx.drawImage(skyImage, 0, 0);
    ctx.drawImage(groundImage, 0, 500);
    
    // Draw key images
    for (let i = 0; i < keyImages.length; i++) {
        const posX = 300 + i * 150;
        const posY = 100;
        
        if (highlightedKey === i) {
            ctx.strokeStyle = 'rgb(255, 255, 0)';
            ctx.lineWidth = 3;
            ctx.strokeRect(posX - 5, posY - 5, keyImages[i].width + 10, keyImages[i].height + 10);
        }
        
        ctx.drawImage(keyImages[i], posX, posY);
    }
    
    displayScore(score);
    playerSprite.draw(ctx);
    playerSprite.update();
    
    for (const obstacle of obstacleGroup) {
        obstacle.draw(ctx);
        obstacle.update();
    }
}

// Check for collision between player and obstacles
function collisionSprite() {
    for (const obstacle of obstacleGroup) {
        // Simple rectangular collision detection
        if (playerSprite.rect.x < obstacle.rect.x + obstacle.rect.width/2 &&
            playerSprite.rect.x + playerSprite.rect.width/2 > obstacle.rect.x - obstacle.rect.width/2 &&
            playerSprite.rect.y - playerSprite.rect.height < obstacle.rect.y &&
            playerSprite.rect.y > obstacle.rect.y - obstacle.rect.height) {
            return true;
        }
    }
    return false;
}

// Get correct key based on TI and surface values
function getCorrectKey(ti, surface) {
    const netTi = ti - backgroundNum;
    const netSurface = surface - backgroundNum;

    if (netTi === 0 && netSurface === 0) {
        return 0;
    } else if (netTi === 0 && netSurface <= 0.5) {
        return 1;
    } else if (0 < netTi && netTi < 1 && 0.5 < netSurface && netSurface < 50) {
        return 2;
    } else if (1 <= netTi && netTi < 10 && 50 < netSurface && netSurface < 200) {
        return 3;
    } else {
        return null;
    }
}

// Reset game state
function resetGame() {
    if (gameOver) {
        sessionCount++;
        // Send xAPI statement for game replay
        sendXapiStatement({
            name: playerName,
            email: playerEmail,
            verb_display: "restarted",
            verb_id: "http://adlnet.gov/expapi/verbs/restarted",
            object_display: "Radiation Game Session",
            object_id: "https://hyeinhaley.github.io/radiation-game/session",
            extensions: {
                "https://example.com/session": sessionCount,
                "https://example.com/previous_score": score
            }
        });
    }
    
    gameActive = true;
    paused = false;
    gameOver = false;
    showResult = false;
    resultMessage = null;
    score = 0;
    highlightedKey = null;
    obstacleGroup = [];
    playerSprite.setReading(0.00);
    gameStartTime = Date.now();
    
    // Background radiation is between 0 and 0.07 mR/hr
    backgroundNum = roundToDecimal(uniform(0, 0.07), 2);
}

// xAPI helper function for package interaction
function sendPackageInteraction(tiNum, surfaceNum, correctKey, playerKey, isCorrect) {
    const resultText = isCorrect ? "correct" : "incorrect";

    const readableSummary = 
        `ti_num: ${tiNum.toFixed(2)}, ` +
        `surface_num: ${surfaceNum.toFixed(2)}, ` +
        `correct_key: ${correctKey}, ` +
        `player answer: ${resultText}`;

    sendXapiStatement({
        name: playerName,
        email: playerEmail,
        verb_display: "answered",
        verb_id: "http://adlnet.gov/expapi/verbs/answered",
        object_display: "Package Classification Question",
        object_id: "https://hyeinhaley.github.io/radiation-game/package-interaction",
        result: {
            success: isCorrect,
            score: {
                raw: isCorrect ? 1 : 0,
                min: 0,
                max: 1
            }
        },
        extensions: {
            "https://example.com/ti_num": tiNum,
            "https://example.com/surface_num": surfaceNum,
            "https://example.com/correct_key": correctKey,
            "https://example.com/player_answer": playerKey,
            "https://example.com/result": resultText,
            "https://example.com/background": backgroundNum
        },
        description_override: readableSummary
    });
}

// xAPI helper function for game end
function sendGameEnd(finalScore, duration) {
    sendXapiStatement({
        name: playerName,
        email: playerEmail,
        verb_display: "completed",
        verb_id: "http://adlnet.gov/expapi/verbs/completed",
        object_display: "Radiation Game Session",
        object_id: "https://hyeinhaley.github.io/radiation-game/session",
        result: {
            score: {
                raw: finalScore,
                min: 0
            },
            completion: true
        },
        extensions: {
            "https://example.com/session": sessionCount,
            "https://example.com/duration_seconds": Math.round(duration * 100) / 100
        }
    });
}

// xAPI helper function for game start
function sendGameStart() {
    sendXapiStatement({
        name: playerName,
        email: playerEmail,
        verb_display: "launched",
        verb_id: "http://adlnet.gov/expapi/verbs/launched",
        object_display: "Radiation Game Session",
        object_id: "https://hyeinhaley.github.io/radiation-game/session",
        extensions: {
            "https://example.com/profession": playerProfession,
            "https://example.com/session": sessionCount,
            "https://example.com/background_radiation": backgroundNum
        }
    });
}

// Collect player information
function collectPlayerInfo() {
    // Hide game canvas
    canvas.style.display = 'none';
    
    // Create form container
    const formContainer = document.createElement('div');
    formContainer.style.width = '800px';
    formContainer.style.margin = '0 auto';
    formContainer.style.padding = '20px';
    formContainer.style.backgroundColor = 'rgb(94, 129, 162)';
    formContainer.style.color = 'white';
    formContainer.style.textAlign = 'center';
    
    // Title
    const title = document.createElement('h1');
    title.textContent = 'Player Information';
    title.style.fontSize = '50px';
    title.style.marginBottom = '30px';
    formContainer.appendChild(title);
    
    // Create form
    const form = document.createElement('form');
    form.id = 'playerInfoForm';
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '20px';
    
    // Name input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name:';
    nameLabel.style.fontSize = '35px';
    nameLabel.style.textAlign = 'left';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'playerName';
    nameInput.required = true;
    nameInput.style.padding = '10px';
    nameInput.style.fontSize = '25px';
    nameLabel.appendChild(nameInput);
    form.appendChild(nameLabel);
    
    // Email input
    const emailLabel = document.createElement('label');
    emailLabel.textContent = 'Email:';
    emailLabel.style.fontSize = '35px';
    emailLabel.style.textAlign = 'left';
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.id = 'playerEmail';
    emailInput.required = true;
    emailInput.style.padding = '10px';
    emailInput.style.fontSize = '25px';
    emailLabel.appendChild(emailInput);
    form.appendChild(emailLabel);
    
    // Profession input
    const profLabel = document.createElement('label');
    profLabel.textContent = 'Profession:';
    profLabel.style.fontSize = '35px';
    profLabel.style.textAlign = 'left';
    const profInput = document.createElement('input');
    profInput.type = 'text';
    profInput.id = 'playerProfession';
    profInput.required = true;
    profInput.style.padding = '10px';
    profInput.style.fontSize = '25px';
    profLabel.appendChild(profInput);
    form.appendChild(profLabel);
    
    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Start Game';
    submitBtn.style.marginTop = '20px';
    submitBtn.style.padding = '15px';
    submitBtn.style.fontSize = '30px';
    submitBtn.style.backgroundColor = 'rgb(111, 196, 169)';
    submitBtn.style.color = 'white';
    submitBtn.style.border = 'none';
    submitBtn.style.cursor = 'pointer';
    form.appendChild(submitBtn);
    
    // Form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        playerName = document.getElementById('playerName').value;
        playerEmail = document.getElementById('playerEmail').value;
        playerProfession = document.getElementById('playerProfession').value;
        playerInfoCollected = true;
        
        // Remove form and show canvas
        document.body.removeChild(formContainer);
        canvas.style.display = 'block';
        
        // Continue with game
        console.log(`Player info collected: ${playerName}, ${playerEmail}, ${playerProfession}`);
        gameLoop(0);
    });
    
    formContainer.appendChild(form);
    document.body.appendChild(formContainer);
}

// Create a new obstacle with properties based on target key
function createObstacle() {
    if (obstacleGroup.length === 0) {
        const newObstacle = new Obstacle();
        obstacleGroup.push(newObstacle);
        collidedObstacle = newObstacle;
        
        // Random target key
        const targetKey = Math.floor(Math.random() * 4);
        
        // For all cases, background_num is between 0 and 0.07
        if (targetKey === 0) {
            // Case 0: ti_num equals background_num (0-0.07)
            collidedObstacle.tiNum = backgroundNum;
            collidedObstacle.surfaceNum = backgroundNum;
            correctKey = 0;
        } else if (targetKey === 1) {
            // Case 1: ti_num equals background_num, surface slightly higher
            collidedObstacle.tiNum = backgroundNum;
            collidedObstacle.surfaceNum = roundToDecimal(backgroundNum + uniform(0.01, 0.5), 2);
            correctKey = 1;
        } else if (targetKey === 2) {
            // Case 2: ti_num slightly above background, surface moderately higher
            collidedObstacle.tiNum = roundToDecimal(backgroundNum + uniform(0.01, 0.99), 3);
            collidedObstacle.surfaceNum = roundToDecimal(backgroundNum + uniform(0.51, 49.99), 2);
            correctKey = 2;
        } else if (targetKey === 3) {
            // Case 3: ti_num significantly above background, surface much higher
            collidedObstacle.tiNum = roundToDecimal(backgroundNum + uniform(1.01, 9.9), 2);
            collidedObstacle.surfaceNum = roundToDecimal(backgroundNum + uniform(50.01, 199.99), 2);
            correctKey = 3;
        }
        
        playerSprite.setReading(collidedObstacle.tiNum);
    }
}

// Main game initialization
function init() {
    // Set up canvas
    canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 600;
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    canvas.style.border = '1px solid black';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    
    // Load assets
    skyImage = new Image();
    skyImage.src = 'graphics/Sky.png';
    
    groundImage = new Image();
    groundImage.src = 'graphics/ground.png';
    
    symbolImage = new Image();
    symbolImage.src = 'graphics/symbol.png';
    
    // Load key images
    for (let i = 0; i < 4; i++) {
        const keyImg = new Image();
        keyImg.src = `graphics/keys/${i}.png`;
        keyImg.onload = () => {
            keyImages[i] = keyImg;
        };
        keyImg.onerror = () => {
            // Create fallback colored rectangle if image is missing
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 100;
            tempCanvas.height = 100;
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCtx.fillStyle = `rgb(${50 * i}, 100, 150)`;
            tempCtx.fillRect(0, 0, 100, 100);
            tempCtx.strokeStyle = 'white';
            tempCtx.lineWidth = 3;
            tempCtx.strokeRect(0, 0, 100, 100);
            
            tempCtx.fillStyle = 'white';
            tempCtx.font = '40px Arial';
            tempCtx.textAlign = 'center';
            tempCtx.textBaseline = 'middle';
            tempCtx.fillText(i.toString(), 50, 50);
            
            const fallbackImg = new Image();
            fallbackImg.src = tempCanvas.toDataURL();
            keyImages[i] = fallbackImg;
        };
    }
    
    // Try to load background music
    try {
        bgMusic = new Audio('audio/music.mp3');
        bgMusic.loop = true;
        
        // Add autoplay with user interaction
        document.addEventListener('click', function tryPlayMusic() {
            bgMusic.play().catch(e => console.log("Music playback failed:", e));
            document.removeEventListener('click', tryPlayMusic);
        }, { once: true });
    } catch (err) {
        console.log("Warning: Could not load background music");
    }
    
    // Create player
    playerSprite = new Player();
    
    // Set up key event listeners
    document.addEventListener('keydown', handleKeyDown);
    
    // Collect player info
    if (!playerInfoCollected) {
        collectPlayerInfo();
    } else {
        gameLoop(0);
    }
}

// Handle key presses
function handleKeyDown(event) {
    if (event.key === ' ') {
        if (!gameActive) {
            resetGame();
            
            // Track game start with xAPI
            if (!hasSentStart) {
                sendGameStart();
                hasSentStart = true;
            }
        }
    } else if (paused && ['0', '1', '2', '3'].includes(event.key)) {
        const pressedKey = parseInt(event.key);
        const isCorrect = pressedKey === correctKey;
        
        if (isCorrect) {
            resultMessage = "Correct!";
            score += 1;
        } else {
            resultMessage = "Incorrect!";
            gameOver = true;
        }
        
        // Send xAPI about this package interaction
        sendPackageInteraction(
            collidedObstacle.tiNum,
            collidedObstacle.surfaceNum,
            correctKey,
            pressedKey,
            isCorrect
        );
        
        // If game over, send final stats
        if (gameOver) {
            const gameDuration = (Date.now() - gameStartTime) / 1000;
            sendGameEnd(score, gameDuration);
        }
        
        resultTimer = Date.now();
        showResult = true;
        obstacleGroup = [];
    } else if (gameActive && !paused && ['0', '1', '2', '3'].includes(event.key)) {
        highlightedKey = parseInt(event.key);
    }
}

// Main game loop
function gameLoop(timestamp) {
    // Calculate delta time
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (gameActive) {
        // Draw game background
        ctx.drawImage(skyImage, 0, 0, canvas.width, canvas.height);
        ctx.drawImage(groundImage, 0, 500, canvas.width, 100);
        
        // Draw key images
        for (let i = 0; i < keyImages.length; i++) {
            if (keyImages[i]) {
                const posX = 300 + i * 150;
                const posY = 100;
                
                if (highlightedKey === i) {
                    ctx.strokeStyle = 'rgb(255, 255, 0)';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(posX - 5, posY - 5, keyImages[i].width + 10, keyImages[i].height + 10);
                }
                
                ctx.drawImage(keyImages[i], posX, posY);
            }
        }
        
        if (!paused) {
            // Spawn new obstacle periodically
            if (timestamp - lastObstacleTime >= obstacleTimerInterval) {
                createObstacle();
                lastObstacleTime = timestamp;
            }
            
            displayScore(score);
            playerSprite.draw(ctx);
            playerSprite.update();
            
            for (const obstacle of obstacleGroup) {
                obstacle.draw(ctx);
                obstacle.update();
            }
            
            if (collisionSprite()) {
                paused = true;
                collidedObstacle = obstacleGroup[0];
                playerSprite.setReading(collidedObstacle.surfaceNum);
                console.log(`📦 ti_num: ${collidedObstacle.tiNum.toFixed(2)}, surface_num: ${collidedObstacle.surfaceNum.toFixed(2)}, correct_key: ${correctKey}`);
            }
        } else {
            // Draw paused state
            playerSprite.draw(ctx);
            
            for (const obstacle of obstacleGroup) {
                obstacle.draw(ctx);
            }
            
            if (collidedObstacle) {
                displayTiIndex(collidedObstacle.tiNum);
            }
            
            ctx.font = '45px Pixeltype, Arial';
            
            if (resultMessage) {
                ctx.fillStyle = resultMessage === "Correct!" ? 'rgb(0, 255, 0)' : 'rgb(255, 0, 0)';
                ctx.fillText(resultMessage, 400, 50);
            } else {
                ctx.fillStyle = 'rgb(255, 0, 0)';
                ctx.fillText('Collision! Press 0, 1, 2, or 3 to continue.', 400, 50);
            }
        }
        
        // Show correct/incorrect result for 0.5 seconds
        if (showResult && Date.now() - resultTimer >= 500) {
            resultMessage = null;
            showResult = false;
            if (!gameOver) {
                paused = false;
            } else {
                gameActive = false;
            }
        }
    } else {
        // Draw title/game over screen
        ctx.fillStyle = 'rgb(94, 129, 162)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        obstacleGroup = [];
        
        // Display package image (symbol)
        if (symbolImage.complete) {
            const symbolX = 600 - symbolImage.width / 2;
            const symbolY = 300 - symbolImage.height / 2;
            ctx.drawImage(symbolImage, symbolX, symbolY);
        }
        
        // Game title
        ctx.font = '45px Pixeltype, Arial';
        ctx.fillStyle = 'rgb(111, 196, 169)';
        const titleText = 'Radioactive Package Game';
        const titleWidth = ctx.measureText(titleText).width;
        ctx.fillText(titleText, 600 - titleWidth/2, 120);
        
        if (score) {
            // Game over messages
            const gameOverText = 'Game Over! Press space to restart.';
            const gameOverWidth = ctx.measureText(gameOverText).width;
            ctx.fillText(gameOverText, 600 - gameOverWidth/2, 450);
            
            const scoreText = `Your score: ${score}`;
            const scoreWidth = ctx.measureText(scoreText).width;
            ctx.fillText(scoreText, 600 - scoreWidth/2, 500);
        } else {
            // Start game message
            const startText = 'Press space to run';
            const startWidth = ctx.measureText(startText).width;
            ctx.fillText(startText, 600 - startWidth/2, 450);
        }
    }
    
    requestAnimationFrame(gameLoop);
}

// Load custom font
function loadFonts() {
    const pixelTypeFont = new FontFace('Pixeltype', 'url(font/Pixeltype.ttf)');
    
    pixelTypeFont.load().then(function(loadedFont) {
        document.fonts.add(loadedFont);
        console.log('Font loaded successfully');
        
        // Start game after font is loaded
        init();
    }).catch(function(error) {
        console.log('Font loading failed:', error);
        
        // Start game anyway with fallback font
        init();
    });
}

// Start everything when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Try to load fonts, fall back to system fonts if needed
    if ('FontFace' in window) {
        loadFonts();
    } else {
        console.log('FontFace API not supported, using fallback fonts');
        init();
    }
});
