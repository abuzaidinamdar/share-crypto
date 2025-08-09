   document.addEventListener('DOMContentLoaded', function() {
            // DOM elements
            const connectWalletBtns = document.querySelectorAll('.connect-wallet-btn');
            const walletInfo = document.getElementById('walletInfo');
            const walletAddress = document.getElementById('walletAddress');
            const walletBalance = document.getElementById('walletBalance');
            const sendForm = document.getElementById('sendForm');
            const sendBtn = document.getElementById('sendBtn');
            const recipientAddress = document.getElementById('recipientAddress');
            const amount = document.getElementById('amount');
            const transactionStatus = document.getElementById('transactionStatus');
            const statusMessage = document.getElementById('statusMessage');
            const txHashLink = document.getElementById('txHashLink');
            const generateQRBtn = document.getElementById('generateQRBtn');
            const qrCodeContainer = document.getElementById('qrCodeContainer');
            const qrCode = document.getElementById('qrCode');
            const historyList = document.getElementById('historyList');

            // Sepolia network details
            const sepoliaNetwork = {
                chainId: '0xaa36a7', // 11155111 in decimal
                chainName: 'Sepolia',
                nativeCurrency: {
                    name: 'SepoliaETH',
                    symbol: 'ETH',
                    decimals: 18
                },
                rpcUrls: ['https://rpc.sepolia.org'],
                blockExplorerUrls: ['https://sepolia.etherscan.io']
            };

            let provider;
            let signer;
            let userAddress;

            // Load saved transactions from localStorage
            let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
            renderTransactionHistory();

            // Update wallet connection buttons
            function updateWalletButtons(connected = false) {
                connectWalletBtns.forEach(btn => {
                    if (connected) {
                        btn.innerHTML = `<i class="fas fa-check-circle"></i><span>Wallet Connected</span>`;
                        btn.classList.add('connected');
                    } else {
                        btn.innerHTML = `<i class="fas fa-wallet"></i><span>Connect Wallet</span>`;
                        btn.classList.remove('connected');
                    }
                });
            }

            // Generate QR Code
            generateQRBtn.addEventListener('click', () => {
                if (userAddress) {
                    QRCode.toCanvas(qrCode, userAddress, { width: 150 }, (error) => {
                        if (error) console.error(error);
                    });
                    qrCodeContainer.classList.toggle('hidden');
                }
            });

            // Connect wallet function
            async function connectWallet() {
                try {
                    if (window.ethereum) {
                        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                        userAddress = accounts[0];

                        provider = new ethers.providers.Web3Provider(window.ethereum);
                        signer = provider.getSigner();

                        const network = await provider.getNetwork();
                        if (network.chainId !== 11155111) {
                            try {
                                await window.ethereum.request({
                                    method: 'wallet_switchEthereumChain',
                                    params: [{ chainId: sepoliaNetwork.chainId }],
                                });
                            } catch (switchError) {
                                if (switchError.code === 4902) {
                                    try {
                                        await window.ethereum.request({
                                            method: 'wallet_addEthereumChain',
                                            params: [sepoliaNetwork],
                                        });
                                    } catch (addError) {
                                        throw new Error('Failed to add Sepolia network to MetaMask');
                                    }
                                } else {
                                    throw switchError;
                                }
                            }
                        }

                        walletAddress.textContent = userAddress;
                        updateBalance();
                        walletInfo.classList.remove('hidden');
                        updateWalletButtons(true);
                        sendBtn.disabled = false;

                        window.ethereum.on('accountsChanged', (accounts) => {
                            if (accounts.length === 0) {
                                disconnectWallet();
                            } else {
                                userAddress = accounts[0];
                                walletAddress.textContent = userAddress;
                                updateBalance();
                            }
                        });

                        window.ethereum.on('chainChanged', () => {
                            window.location.reload();
                        });
                    } else {
                        throw new Error('MetaMask not detected. Please install MetaMask to use this feature.');
                    }
                } catch (error) {
                    console.error('Error connecting wallet:', error);
                    alert(error.message);
                }
            }

            // Disconnect wallet function
            function disconnectWallet() {
                walletInfo.classList.add('hidden');
                updateWalletButtons(false);
                sendBtn.disabled = true;
                userAddress = null;
                provider = null;
                signer = null;
            }

            // Update wallet balance
            async function updateBalance() {
                if (userAddress && provider) {
                    const balance = await provider.getBalance(userAddress);
                    const balanceInEth = ethers.utils.formatEther(balance);
                    walletBalance.textContent = parseFloat(balanceInEth).toFixed(4);
                }
            }

            // Render transaction history
            function renderTransactionHistory() {
                historyList.innerHTML = '';
                if (transactions.length === 0) {
                    historyList.innerHTML = '<p>No transactions yet.</p>';
                    return;
                }
                transactions.slice().reverse().forEach(tx => {
                    const txElement = document.createElement('div');
                    txElement.className = 'transaction-item';
                    txElement.innerHTML = `
                        <p><strong>To:</strong> ${tx.to.substring(0, 6)}...${tx.to.substring(tx.to.length - 4)}</p>
                        <p><strong>Amount:</strong> ${tx.amount} ETH</p>
                        <p><strong>Date:</strong> ${new Date(tx.timestamp).toLocaleString()}</p>
                        <a href="https://sepolia.etherscan.io/tx/${tx.txHash}" target="_blank">View on Etherscan</a>
                    `;
                    historyList.appendChild(txElement);
                });
            }

            // Save transaction to history
            function saveTransaction(txHash, to, amount) {
                const newTx = {
                    txHash,
                    to,
                    amount,
                    timestamp: Date.now()
                };
                transactions.push(newTx);
                localStorage.setItem('transactions', JSON.stringify(transactions));
                renderTransactionHistory();
            }

            // Send transaction function
            async function sendTransaction() {
                try {
                    const toAddress = recipientAddress.value.trim();
                    const ethAmount = amount.value.trim();

                    if (!ethers.utils.isAddress(toAddress)) {
                        throw new Error('Invalid recipient address');
                    }

                    if (isNaN(ethAmount) || parseFloat(ethAmount) <= 0) {
                        throw new Error('Invalid amount');
                    }

                    const amountWei = ethers.utils.parseEther(ethAmount);

                    transactionStatus.classList.remove('hidden', 'success', 'error');
                    transactionStatus.classList.add('success');
                    statusMessage.textContent = 'Sending transaction...';
                    txHashLink.classList.add('hidden');

                    const tx = await signer.sendTransaction({
                        to: toAddress,
                        value: amountWei
                    });

                    statusMessage.textContent = 'Transaction submitted! Waiting for confirmation...';
                    txHashLink.href = `https://sepolia.etherscan.io/tx/${tx.hash}`;
                    txHashLink.textContent = `Transaction: ${tx.hash.substring(0, 12)}...${tx.hash.substring(tx.hash.length - 6)}`;
                    txHashLink.classList.remove('hidden');

                    const receipt = await tx.wait();

                    statusMessage.textContent = `Transaction confirmed in block ${receipt.blockNumber}`;
                    transactionStatus.classList.add('success');

                    saveTransaction(tx.hash, toAddress, ethAmount);
                    updateBalance();
                    sendForm.reset();
                } catch (error) {
                    console.error('Error sending transaction:', error);
                    transactionStatus.classList.remove('hidden', 'success', 'error');
                    transactionStatus.classList.add('error');
                    statusMessage.textContent = `Error: ${error.message}`;
                    txHashLink.classList.add('hidden');
                }
            }

            // Event listeners
            connectWalletBtns.forEach(btn => {
                btn.addEventListener('click', connectWallet);
            });
            
            sendForm.addEventListener('submit', function(e) {
                e.preventDefault();
                sendTransaction();
            });
        });