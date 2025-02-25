document.addEventListener("DOMContentLoaded", () => {
    createChartForSymbol('BTCUSDT', 'btcChart', 'btcTimeFilter', 'rgb(247, 147, 26)'); // Bitcoin orange
    createChartForSymbol('ETHUSDT', 'ethChart', 'ethTimeFilter', 'rgb(98, 126, 234)'); // Ethereum blue
    createChartForSymbol('XRPUSDT', 'xrpChart', 'xrpTimeFilter', 'rgb(0, 0, 0)');      // XRP black
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
    const response = await fetch(`/api/prices?filter=${timeFilter}&symbol=${symbol}`, {
        credentials: 'include'
    });
    const data = await response.json();
    
    return {
        labels: data.map(entry => {
            const date = new Date(entry.timestamp);
            switch(timeFilter) {
                case "24h":
                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                case "7d":
                case "30d":
                    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                default:
                    return date.toLocaleTimeString();
            }
        }),
        prices: data.map(entry => entry.price)
    };
}


async function updateChart(chart, timeFilter, symbol) {
    const { labels, prices } = await fetchData(timeFilter, symbol);
    chart.data.labels = labels;
    chart.data.datasets[0].data = prices;
    chart.update();
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
    const ctx = document.getElementById(elementId).getContext("2d");
    const timeFilter = document.getElementById(filterId).value;
    const { labels, prices } = await fetchData(timeFilter, symbol);

    const chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: `Price ${symbol}`,
                data: prices,
                borderColor: color,
                borderWidth: 2,
                fill: true,
                backgroundColor: `${color}1A`,
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
                            size: 16,
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


    document.getElementById(filterId).addEventListener("change", async (event) => {
        const newTimeFilter = event.target.value;
        const { labels, prices } = await fetchData(newTimeFilter, symbol);
        
        chart.data.labels = labels;
        chart.data.datasets[0].data = prices;
        chart.options.scales.x.ticks.maxTicksLimit = newTimeFilter === "24h" ? 12 : 10;
        chart.update();
    });

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

