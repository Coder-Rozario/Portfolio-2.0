require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

// Helper function to prevent HTML Injection (XSS) in Emails
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (match) {
    const chars = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return chars[match];
  });
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));

// CORS configuration - FIXED: Secure RegEx implementation
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
      'https://shuvo-rozario.netlify.app'
    ];

    // Secure checks for localhost and loopback IPs
    const isLocalhost = !!origin && /^http:\/\/localhost(:\d+)?$/.test(origin);
    const isLoopback = !!origin && /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);

    if (!origin || allowedOrigins.includes(origin) || isLocalhost || isLoopback) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Handle preflight requests
app.options('*', cors());

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting to prevent Brute Force/DDoS on contact endpoint
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' }
});
app.use(limiter);

// Email transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',  
  port: 465,               
  secure: true,           
  pool: true,
  maxConnections: 2,
  maxMessages: Infinity,
  connectionTimeout: 15000,
  socketTimeout: 20000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false 
  }
});

// Test email configuration on startup
transporter.verify(function (error, success) {
  if (error) {
    console.log('❌ Email configuration error:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

// ==================== HEALTH CHECK ENDPOINT ====================
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'Portfolio server is running smoothly'
  });
});

// ==================== CONTACT LOGIC FUNCTION ====================
// Fixed: Separate logic to avoid app.handle() breakdown
const handleContactForm = async (req, res) => {
  try {
    console.log('📨 Received contact form submission:', req.body);
    
    const { name, number, email, message } = req.body;

    // Enhanced validation
    if (!name || !number || !email || !message) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required' 
      });
    }

    // Name validation
    if (name.trim().length < 2) {
      return res.status(400).json({ 
        success: false,
        message: 'Name must be at least 2 characters long' 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide a valid email address' 
      });
    }

    // Phone number validation (basic)
    if (String(number).trim().length < 10) {
      return res.status(400).json({ 
        success: false,
        message: 'Please provide a valid phone number' 
      });
    }

    // Message length validation
    if (message.trim().length < 10) {
      return res.status(400).json({ 
        success: false,
        message: 'Message must be at least 10 characters long' 
      });
    }

    if (message.trim().length > 1000) {
      return res.status(400).json({ 
        success: false,
        message: 'Message must be less than 1000 characters' 
      });
    }

    // SEXT / XSS Protection: Escaping inputs before putting into HTML
    const safeName = escapeHTML(name.trim());
    const safeNumber = escapeHTML(String(number).trim());
    const safeEmail = escapeHTML(email.trim());
    const safeMessage = escapeHTML(message.trim());

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO,
      subject: `📧 New Portfolio Message from ${safeName}`,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Portfolio Contact</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; }
        .email-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2); }
        .email-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; color: white; }
        .email-header h1 { font-size: 28px; font-weight: 600; margin-bottom: 10px; }
        .email-body { padding: 30px; }
        .contact-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 25px; border-left: 4px solid #667eea; }
        .info-item { margin-bottom: 12px; display: flex; }
        .info-label { font-weight: 600; color: #495057; min-width: 80px; }
        .info-value { color: #212529; flex: 1; }
        .message-section { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; }
        .message-label { font-weight: 600; color: #495057; margin-bottom: 10px; font-size: 16px; }
        .message-content { color: #212529; white-space: pre-wrap; }
        .email-footer { background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>🎉 New Portfolio Message</h1>
            <p>Someone reached out through your portfolio website</p>
        </div>
        <div class="email-body">
            <div class="contact-info">
                <div class="info-item"><span class="info-label">Name:</span><span class="info-value">${safeName}</span></div>
                <div class="info-item"><span class="info-label">Phone:</span><span class="info-value"><a href="tel:${safeNumber}">${safeNumber}</a></span></div>
                <div class="info-item"><span class="info-label">Email:</span><span class="info-value"><a href="mailto:${safeEmail}">${safeEmail}</a></span></div>
                <div class="info-item"><span class="info-label">Time:</span><span class="info-value">${new Date().toLocaleString()}</span></div>
            </div>
            <div class="message-section">
                <div class="message-label">Message Content:</div>
                <div class="message-content">${safeMessage}</div>
            </div>
        </div>
        <div class="email-footer">
            <p style="color: #6c757d; font-size: 14px;">💼 Sent from portfolio contact form</p>
        </div>
    </div>
</body>
</html>
      `,
    };

    const userConfirmationMail = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: '✅ Thank you for contacting Shuvro Rozario',
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thank You Message</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background: #f8f9fa; padding: 20px; }
        .email-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1); }
        .email-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; }
        .email-body { padding: 40px 30px; }
        .next-steps { background: #f8f9fa; border-radius: 8px; padding: 25px; margin: 25px 0; }
        .next-steps ul { list-style: none; padding: 0; }
        .next-steps li { padding: 8px 0; padding-left: 25px; position: relative; }
        .next-steps li:before { content: "✓"; position: absolute; left: 0; color: #28a745; font-weight: bold; }
        .email-footer { background: #343a40; color: white; padding: 25px; text-align: center; }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>Thank You, ${safeName}!</h1>
            <p>I've received your message and will get back to you soon</p>
        </div>
        <div class="email-body">
            <p style="font-size: 16px; color: #495057; text-align: center;">I appreciate you taking the time to contact me through my portfolio website.</p>
            <div class="next-steps">
                <h3>What happens next?</h3>
                <ul>
                    <li>I'll review your message carefully</li>
                    <li>You'll receive a response within 24 hours</li>
                </ul>
            </div>
            <div style="text-align: center; margin-top: 30px;">
                <p><strong>Best regards,</strong><br>Shuvro Rozario</p>
            </div>
        </div>
        <div class="email-footer">
            <p>© ${new Date().getFullYear()} Shuvro Rozario. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
      `
    };

    // Deliver emails concurrently before sending HTTP response
    const results = await Promise.allSettled([
      transporter.sendMail(mailOptions),
      transporter.sendMail(userConfirmationMail)
    ]);
    
    console.log(`✅ Email process status for ${safeName}:`, results.map(r => r.status));

    if (results[0].status === 'rejected' && results[1].status === 'rejected') {
      throw new Error(`Email dispatch failed entirely.`);
    }

    return res.status(200).json({ 
      success: true,
      message: 'Message received! A confirmation email will arrive shortly.' 
    });
    
  } catch (error) {
    console.error('❌ Contact form error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Failed to send message. Please try again later.'
    });
  }
};

// Map both endpoints to the safe handler function
app.post('/api/messages', handleContactForm);
app.post('/api/contact', handleContactForm);

// ==================== ADDITIONAL PORTFOLIO ENDPOINTS ====================

app.get('/api/projects', (req, res) => {
  const projects = [
    {
      id: 1,
      title: "Yokebud E-commerce",
      description: "Full-stack e-commerce platform with advanced features",
      technologies: ["React", "Node.js", "MySQL", "Cloudinary"],
      category: "Full Stack",
      image: "/projects/yokebud.jpg",
      liveUrl: "https://yokebud.com",
      githubUrl: "https://github.com/yourusername/yokebud"
    },
    {
      id: 2,
      title: "Portfolio Website",
      description: "Responsive portfolio with contact form and email integration",
      technologies: ["React", "Node.js", "Express", "Nodemailer"],
      category: "Full Stack",
      image: "/projects/portfolio.jpg",
      liveUrl: "https://shuvorozario.com",
      githubUrl: "https://github.com/yourusername/portfolio"
    }
  ];
  res.json({ success: true, projects });
});

app.get('/api/skills', (req, res) => {
  const skills = {
    frontend: [
      { name: "React", level: 90 },
      { name: "JavaScript", level: 85 },
      { name: "HTML5", level: 95 },
      { name: "CSS3", level: 90 }
    ],
    backend: [
      { name: "Node.js", level: 88 },
      { name: "Express.js", level: 85 },
      { name: "MySQL", level: 80 },
      { name: "MongoDB", level: 75 }
    ]
  };
  res.json({ success: true, skills });
});

// ==================== ERROR HANDLING ====================
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error'
  });
});

app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found' 
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Portfolio Backend Server is running!',
    endpoints: {
      health: '/health',
      contact: '/api/contact & /api/messages',
      projects: '/api/projects',
      skills: '/api/skills'
    },
    timestamp: new Date().toISOString()
  });
});

// ==================== SERVER STARTUP ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Portfolio server running on port ${PORT}`);
  
  const keepAliveUrl = process.env.KEEP_ALIVE_URL || `http://localhost:${PORT}/health`;
  const ping = () => {
    try {
      const client = keepAliveUrl.startsWith('https') ? require('https') : require('http');
      const req = client.get(keepAliveUrl, (res) => { res.resume(); });
      req.on('error', () => {});
      req.setTimeout(8000, () => req.destroy());
    } catch {}
  };
  setInterval(ping, 14 * 60 * 1000);
  ping();
});
