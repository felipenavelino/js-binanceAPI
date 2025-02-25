document.addEventListener("DOMContentLoaded", () => {
    console.log("Initializing charts..."); // Debug log
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
    console.log(`Fetching data for ${symbol} with filter ${timeFilter}`); // Debug log

    try {
        const response = await fetch(`/api/prices?filter=${timeFilter}&symbol=${symbol}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        console.log(`Received ${data.length} data points for ${symbol}`); // Debug log
        
        return {
            labels: data.map(entry => new Date(entry.timestamp).toLocaleDateString()),
            prices: data.map(entry => entry.price)
        };
    } catch (error) {
        console.error('Error fetching data:', error);
        return { labels: [], prices: [] };
    }
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
    let chart = null;

    async function updateChart(timeFilter) {
        console.log(`Updating chart for ${symbol} with filter ${timeFilter}`); // Debug log
        
        const ctx = document.getElementById(elementId).getContext("2d");
        const chartContainer = ctx.canvas.parentElement;
        chartContainer.classList.add('opacity-50');
        
        try {
            const { labels, prices } = await fetchData(timeFilter, symbol);

            const chartConfig = {
                type: "line",
                data: {
                    labels: labels,
                    datasets: [{
                        label: `${symbol} Price`,
                        data: prices,
                        borderColor: color,
                        borderWidth: 1.5,
                        fill: false,
                        pointRadius: 0,
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index',
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                color: 'rgb(160, 160, 160)',
                                font: {
                                    size: 12
                                }
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(30, 41, 59, 0.9)',
                            titleColor: 'rgb(160, 160, 160)',
                            bodyColor: 'white',
                            borderColor: 'rgb(60, 60, 60)',
                            borderWidth: 1
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(60, 60, 60, 0.2)',
                                drawBorder: false
                            },
                            ticks: {
                                color: 'rgb(160, 160, 160)',
                                font: {
                                    size: 11
                                },
                                maxRotation: 0
                            }
                        },
                        y: {
                            position: 'right',
                            grid: {
                                color: 'rgba(60, 60, 60, 0.2)',
                                drawBorder: false
                            },
                            ticks: {
                                color: 'rgb(160, 160, 160)',
                                font: {
                                    size: 11
                                },
                                callback: function(value) {
                                    return '$' + value.toLocaleString();
                                }
                            }
                        }
                    },
                    animation: {
                        duration: 750,
                        easing: 'easeInOutQuart'
                    }
                }
            };

            if (chart) {
                // Destroy existing chart before creating a new one
                chart.destroy();
            }
            
            // Create new chart
            chart = new Chart(ctx, chartConfig);

        } catch (error) {
            console.error('Error updating chart:', error);
        } finally {
            chartContainer.classList.remove('opacity-50');
        }
    }

    // Adiciona o event listener para o seletor de tempo
    const timeFilterElement = document.getElementById(filterId);
    if (timeFilterElement) {
        timeFilterElement.addEventListener('change', (event) => {
            console.log(`Time filter changed to ${event.target.value}`); // Debug log
            updateChart(event.target.value);
        });

        // Inicializa o gráfico com o valor padrão do seletor
        const initialTimeFilter = timeFilterElement.value;
        await updateChart(initialTimeFilter);
    } else {
        console.error(`Element with id ${filterId} not found`);
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
