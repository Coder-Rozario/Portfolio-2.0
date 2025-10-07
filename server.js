require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Email transporter - FIXED: createTransport not createTransporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
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

// ==================== CONTACT ENDPOINT ====================
app.post('/api/contact', async (req, res) => {
  try {
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
    if (number.trim().length < 10) {
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

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO,
      subject: `📧 New Portfolio Message from ${name}`,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Portfolio Contact</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }
        .email-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px 20px;
            text-align: center;
            color: white;
        }
        .email-header h1 {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 10px;
        }
        .email-header p {
            font-size: 16px;
            opacity: 0.9;
        }
        .email-body {
            padding: 30px;
        }
        .contact-info {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 25px;
            border-left: 4px solid #667eea;
        }
        .info-item {
            margin-bottom: 12px;
            display: flex;
            align-items: center;
        }
        .info-item:last-child {
            margin-bottom: 0;
        }
        .info-label {
            font-weight: 600;
            color: #495057;
            min-width: 80px;
        }
        .info-value {
            color: #212529;
            flex: 1;
        }
        .message-section {
            background: #fff;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
        }
        .message-label {
            font-weight: 600;
            color: #495057;
            margin-bottom: 10px;
            font-size: 16px;
        }
        .message-content {
            color: #212529;
            line-height: 1.7;
            white-space: pre-wrap;
        }
        .email-footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e9ecef;
        }
        .footer-text {
            color: #6c757d;
            font-size: 14px;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            background: #28a745;
            color: white;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            margin-left: 10px;
        }
        a {
            color: #667eea;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
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
                <div class="info-item">
                    <span class="info-label">Name:</span>
                    <span class="info-value">${name}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Phone:</span>
                    <span class="info-value">
                        <a href="tel:${number}">${number}</a>
                    </span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value">
                        <a href="mailto:${email}">${email}</a>
                    </span>
                </div>
                <div class="info-item">
                    <span class="info-label">Time:</span>
                    <span class="info-value">${new Date().toLocaleString()}</span>
                </div>
            </div>
            
            <div class="message-section">
                <div class="message-label">Message Content:</div>
                <div class="message-content">${message}</div>
            </div>
        </div>
        
        <div class="email-footer">
            <p class="footer-text">
                💼 This message was sent from your portfolio contact form<br>
                <small>Powered by your portfolio backend service</small>
            </p>
        </div>
    </div>
</body>
</html>
      `,
    };

    // Send confirmation email to the user
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
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8f9fa;
            padding: 20px;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }
        .email-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
            color: white;
        }
        .email-header h1 {
            font-size: 32px;
            font-weight: 600;
            margin-bottom: 10px;
        }
        .email-body {
            padding: 40px 30px;
        }
        .thank-you-text {
            font-size: 18px;
            color: #495057;
            margin-bottom: 25px;
            text-align: center;
        }
        .next-steps {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 25px;
            margin: 25px 0;
        }
        .next-steps h3 {
            color: #495057;
            margin-bottom: 15px;
            font-size: 20px;
        }
        .next-steps ul {
            list-style: none;
            padding: 0;
        }
        .next-steps li {
            padding: 8px 0;
            padding-left: 25px;
            position: relative;
        }
        .next-steps li:before {
            content: "✓";
            position: absolute;
            left: 0;
            color: #28a745;
            font-weight: bold;
        }
        .contact-info {
            text-align: center;
            margin-top: 30px;
            padding-top: 25px;
            border-top: 1px solid #e9ecef;
        }
        .contact-info a {
            color: #667eea;
            text-decoration: none;
            margin: 0 10px;
        }
        .contact-info a:hover {
            text-decoration: underline;
        }
        .email-footer {
            background: #343a40;
            color: white;
            padding: 25px;
            text-align: center;
        }
        .signature {
            margin-top: 25px;
            font-style: italic;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <h1>Thank You, ${name}!</h1>
            <p>I've received your message and will get back to you soon</p>
        </div>
        
        <div class="email-body">
            <div class="thank-you-text">
                Thank you for reaching out through my portfolio website. I appreciate you taking the time to contact me.
            </div>
            
            <div class="next-steps">
                <h3>What happens next?</h3>
                <ul>
                    <li>I'll review your message carefully</li>
                    <li>You'll receive a personalized response within 24 hours</li>
                    <li>We can schedule a call to discuss your project in detail</li>
                </ul>
            </div>
            
            <div class="contact-info">
                <p><strong>Best regards,</strong><br>Shuvro Rozario</p>
                <div style="margin-top: 15px;">
                    <a href="mailto:portfolio.shuvorozario@gmail.com">📧 Email</a>
                    <a href="https://your-portfolio-link.com">🌐 Portfolio</a>
                </div>
            </div>
            
            <div class="signature">
                <small>This is an automated confirmation. Please do not reply to this email.</small>
            </div>
        </div>
        
        <div class="email-footer">
            <p>&copy; ${new Date().getFullYear()} Shuvro Rozario. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
      `
    };

    // Send both emails
    await transporter.sendMail(mailOptions);
    await transporter.sendMail(userConfirmationMail);

    console.log(`Contact form submitted by: ${name} (${email})`);

    res.status(200).json({ 
      success: true,
      message: 'Message sent successfully! You should receive a confirmation email shortly.' 
    });
    
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send message. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== ADDITIONAL PORTFOLIO ENDPOINTS ====================

// Projects endpoint (you can expand this later)
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
    },
    {
      id: 3,
      title: "Task Management App",
      description: "Real-time task management application with team collaboration",
      technologies: ["React", "Node.js", "Socket.io", "MongoDB"],
      category: "Full Stack",
      image: "/projects/taskapp.jpg",
      liveUrl: "https://taskapp.example.com",
      githubUrl: "https://github.com/yourusername/taskapp"
    }
  ];
  
  res.json({ success: true, projects });
});

// Skills endpoint
app.get('/api/skills', (req, res) => {
  const skills = {
    frontend: [
      { name: "React", level: 90 },
      { name: "JavaScript", level: 85 },
      { name: "HTML5", level: 95 },
      { name: "CSS3", level: 90 },
      { name: "Tailwind CSS", level: 85 }
    ],
    backend: [
      { name: "Node.js", level: 88 },
      { name: "Express.js", level: 85 },
      { name: "MySQL", level: 80 },
      { name: "MongoDB", level: 75 },
      { name: "REST APIs", level: 90 }
    ],
    tools: [
      { name: "Git", level: 85 },
      { name: "Docker", level: 70 },
      { name: "AWS", level: 65 },
      { name: "Cloudinary", level: 80 },
      { name: "JWT", level: 85 }
    ],
    other: [
      "Responsive Design",
      "UI/UX Design",
      "Agile Methodology", 
      "Problem Solving",
      "Team Collaboration",
      "Project Management"
    ]
  };
  
  res.json({ success: true, skills });
});

// Experience endpoint
app.get('/api/experience', (req, res) => {
  const experience = [
    {
      id: 1,
      company: "Freelance",
      position: "Full Stack Developer",
      period: "2023 - Present",
      description: "Working on various web development projects including e-commerce platforms, portfolio websites, and custom web applications.",
      technologies: ["React", "Node.js", "Express", "MySQL", "MongoDB"]
    },
    {
      id: 2,
      company: "Tech Company",
      position: "Frontend Developer",
      period: "2022 - 2023", 
      description: "Developed and maintained responsive web applications using modern JavaScript frameworks and libraries.",
      technologies: ["React", "TypeScript", "Redux", "SASS"]
    }
  ];
  
  res.json({ success: true, experience });
});

// Testimonials endpoint
app.get('/api/testimonials', (req, res) => {
  const testimonials = [
    {
      id: 1,
      name: "John Doe",
      position: "CEO at TechStart",
      message: "Shuvro delivered an exceptional e-commerce platform that exceeded our expectations. His attention to detail and problem-solving skills are remarkable.",
      avatar: "/testimonials/john.jpg",
      rating: 5
    },
    {
      id: 2,
      name: "Jane Smith",
      position: "Project Manager",
      message: "Working with Shuvro was a great experience. He's professional, skilled, and always delivers on time. Highly recommended!",
      avatar: "/testimonials/jane.jpg", 
      rating: 5
    }
  ];
  
  res.json({ success: true, testimonials });
});

// ==================== KEEP-ALIVE MECHANISM ====================
// This will help keep the Render instance awake by pinging itself
const keepAlive = () => {
  const https = require('https');
  
  if (process.env.RENDER_EXTERNAL_URL) {
    console.log('Setting up keep-alive ping for:', process.env.RENDER_EXTERNAL_URL);
    
    setInterval(() => {
      https.get(`${process.env.RENDER_EXTERNAL_URL}/health`, (res) => {
        console.log(`Keep-alive ping successful - Status: ${res.statusCode}`);
      }).on('error', (err) => {
        console.log('Keep-alive ping error:', err.message);
      });
    }, 14 * 60 * 1000); // Ping every 14 minutes (Render sleeps after 15 minutes of inactivity)
  }
};

// ==================== ERROR HANDLING MIDDLEWARE ====================
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'API endpoint not found' 
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Portfolio Backend Server is running!',
    endpoints: {
      health: '/health',
      contact: '/api/contact',
      projects: '/api/projects',
      skills: '/api/skills',
      experience: '/api/experience',
      testimonials: '/api/testimonials'
    },
    timestamp: new Date().toISOString()
  });
});

// ==================== SERVER STARTUP ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Portfolio server running on port ${PORT}`);
  console.log(`📧 Email service: ${process.env.EMAIL_USER ? 'Configured' : 'Not configured'}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  
  // Start keep-alive mechanism if running on Render
  if (process.env.RENDER) {
    keepAlive();
  }
});
