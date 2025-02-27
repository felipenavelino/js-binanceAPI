document.addEventListener("DOMContentLoaded", () => {
    console.log("Initializing charts..."); // Debug log
    createChartForSymbol('BTCUSDT', 'btcChart', 'btcTimeFilter', 'rgb(247, 147, 26)'); // Bitcoin orange
    createChartForSymbol('ETHUSDT', 'ethChart', 'ethTimeFilter', 'rgb(98, 126, 234)'); // Ethereum blue
    createChartForSymbol('XRPUSDT', 'xrpChart', 'xrpTimeFilter', 'rgb(255, 255, 255)'); // XRP white
    createChartForSymbol('SOLUSDT', 'solChart', 'solTimeFilter', 'rgb(20, 241, 149)'); // Solana green
    checkLoginStatus();
    
    // Login form handler
    const loginForm = document.querySelector('#login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.querySelector('#login-email').value;
            const password = document.querySelector('#login-password').value;
            
            try {
                const data = await login(email, password);
                document.getElementById('login-modal').classList.add('hidden');
                // Update UI for logged-in state
            } catch (error) {
                // Handle error (show message to user)
            }
        });
    }

    // Register form handler
    const registerForm = document.querySelector('#signup-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.querySelector('#name').value;
            const email = document.querySelector('#email').value;
            const password = document.querySelector('#password').value;
            
            try {
                const data = await register(username, email, password);
                document.getElementById('signup-modal').classList.add('hidden');
                // Update UI for logged-in state
            } catch (error) {
                // Handle error (show message to user)
            }
        });
    }
});

async function fetchData(timeFilter, symbol) {
    try {
        console.log(`Fetching data for ${symbol} with filter ${timeFilter}`);
        const response = await fetch(`/api/prices?filter=${timeFilter}&symbol=${symbol}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Received ${data.length} data points for ${symbol}`);

        return {
            labels: data.map(entry => {
                const date = new Date(entry.timestamp);
                switch(timeFilter) {
                    case "24h":
                        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    case "7d":
                    case "30d":
                        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                    case "6m":
                    case "1y":
                        return date.toLocaleDateString([], { month: 'short', year: 'numeric' });
                    default:
                        return date.toLocaleTimeString();
                }
            }),
            prices: data.map(entry => Number(entry.price))
        };
    } catch (error) {
        console.error('Error fetching data:', error);
        return { labels: [], prices: [] };
    }
}

async function updateChart(chart, timeFilter, symbol) {
    try {
        const { labels, prices } = await fetchData(timeFilter, symbol);
        
        // Atualiza os dados do gráfico
        chart.data.labels = labels;
        chart.data.datasets[0].data = prices;
        
        // Força a atualização do gráfico
        chart.update('active');
        
    } catch (error) {
        console.error('Error updating chart:', error);
    }
}

async function createChart() {
    const ctx = document.getElementById("priceChart").getContext("2d");
    const timeFilter = document.getElementById("timeFilter").value;
    const { labels, prices } = await fetchData(timeFilter);

    const chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Price BTC/USDT",
                data: prices,
                borderColor: "rgb(59, 130, 246)", 
                borderWidth: 2,
                fill: true,
                backgroundColor: "rgba(59, 130, 246, 0.1)", 
                tension: 0.4 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                    align: 'start',
                    labels: {
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        padding: 20,
                        color: 'white'
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'white',
                        font: {
                            size: 12
                        },
                        maxRotation: 45,
                        maxTicksLimit: timeFilter === "24h" ? 12 : 10 
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'white',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });

    document.getElementById("timeFilter").addEventListener("change", (event) => {
        updateChart(chart, event.target.value);
    });
}

async function createChartForSymbol(symbol, elementId, filterId, color) {
    let chart = null;

    async function updateChart(timeFilter) {
        try {
            console.log(`Updating chart for ${symbol} with filter ${timeFilter}`);
            const { labels, prices } = await fetchData(timeFilter, symbol);

            if (!chart) {
                const ctx = document.getElementById(elementId).getContext("2d");
                chart = new Chart(ctx, {
                    type: "line",
                    data: {
                        labels: labels,
                        datasets: [{
                            label: `${symbol} Price`,
                            data: prices,
                            borderColor: color,
                            borderWidth: 1,
                            fill: false,
                            backgroundColor: 'transparent',
                            pointRadius: 0,
                            pointHitRadius: 0,
                            pointHoverRadius: 0,
                            tension: 0,
                            showLine: true,
                            pointStyle: false,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {
                            duration: 750,
                            easing: 'easeInOutQuart'
                        },
                        interaction: {
                            intersect: false,
                            mode: 'index',
                        },
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                enabled: true,
                                mode: 'index',
                                intersect: false,
                                backgroundColor: '#0D1117',
                                titleColor: '#fff',
                                bodyColor: '#fff',
                                borderColor: '#1f2937',
                                borderWidth: 1,
                                padding: 8,
                                displayColors: false,
                                callbacks: {
                                    label: function(context) {
                                        return `$${context.parsed.y.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}`;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: {
                                    display: false
                                },
                                ticks: {
                                    display: false
                                }
                            },
                            y: {
                                position: 'right',
                                grid: {
                                    color: 'rgba(255, 255, 255, 0.02)',
                                    drawBorder: false
                                },
                                border: {
                                    display: false
                                },
                                ticks: {
                                    color: 'rgba(255, 255, 255, 0.5)',
                                    font: {
                                        size: 11
                                    },
                                    padding: 10,
                                    callback: function(value) {
                                        return '$' + value.toLocaleString('en-US', {
                                            minimumFractionDigits: 0,
                                            maximumFractionDigits: 0
                                        });
                                    }
                                }
                            }
                        }
                    }
                });
            } else {
                chart.data.labels = labels;
                chart.data.datasets[0].data = prices;
                chart.update('active');
            }
        } catch (error) {
            console.error('Error updating chart:', error);
        }
    }

    // Atualização inicial e configuração do listener para mudança de intervalo
    const timeFilterElement = document.getElementById(filterId);
    if (timeFilterElement) {
        timeFilterElement.addEventListener('change', (event) => {
            updateChart(event.target.value);
        });
        await updateChart(timeFilterElement.value);
    }

    return chart;
}

async function register(username, email, password) {
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
            credentials: 'include'
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        return data;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

async function login(email, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        return data;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Logout failed');
        }

        return data;
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
    }
}

// Funções para controlar os modais
function showLoginModal() {
    document.getElementById('signup-modal').classList.add('hidden');
    document.getElementById('login-modal').classList.remove('hidden');
}

function showSignupModal() {
    document.getElementById('login-modal').classList.add('hidden');
    document.getElementById('signup-modal').classList.remove('hidden');
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type;
    
    // Atualiza o ícone
    const icon = input.nextElementSibling.querySelector('i');
    icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
}
