// Student Data Manager

// Constants
const STORAGE_KEY = 'students_data';

// State
let students = [];

// DOM Elements
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const totalStudentsSpan = document.getElementById('totalStudents');
const searchInput = document.getElementById('searchInput');
const modal = document.getElementById('studentModal');
const studentForm = document.getElementById('studentForm');
const fileInput = document.getElementById('csvFileInput');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    renderTable();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Modal controls
    document.getElementById('addStudentBtn').addEventListener('click', openModal);
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Close modal if clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Form submission
    studentForm.addEventListener('submit', handleFormSubmit);

    // Search
    searchInput.addEventListener('input', (e) => {
        renderTable(e.target.value);
    });

    // Import/Export
    document.getElementById('exportBtn').addEventListener('click', exportCSV);
    document.getElementById('importBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileImport);
}

// Data Management
function loadData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        students = JSON.parse(data);
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    renderTable(searchInput.value);
}

function addStudent(student) {
    students.push(student);
    saveData();
}

function deleteStudent(roll) {
    if (confirm(`Are you sure you want to delete student with Roll No: ${roll}?`)) {
        students = students.filter(s => s.roll != roll);
        saveData();
    }
}

// UI Rendering
function renderTable(query = '') {
    tableBody.innerHTML = '';

    const filteredStudents = students.filter(student => {
        const q = query.toLowerCase();
        return (
            student.name.toLowerCase().includes(q) ||
            student.course.toLowerCase().includes(q) ||
            student.roll.toString().includes(q)
        );
    });

    // Update stats
    totalStudentsSpan.textContent = `${filteredStudents.length} Student${filteredStudents.length !== 1 ? 's' : ''}`;

    // Show/Hide Empty State
    if (filteredStudents.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
    }

    // Populate Rows
    filteredStudents.forEach(student => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(student.name)}</td>
            <td>${student.roll}</td>
            <td>${escapeHtml(student.course)}</td>
            <td>${student.year}</td>
            <td>${parseFloat(student.cgpa).toFixed(2)}</td>
            <td class="actions-col">
                <button class="btn btn-danger" onclick="deleteStudent(${student.roll})" title="Delete">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Modal Handlers
function openModal() {
    studentForm.reset();
    modal.classList.remove('hidden');
    document.getElementById('name').focus();
}

function closeModal() {
    modal.classList.add('hidden');
}

function handleFormSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const roll = parseInt(document.getElementById('roll').value);
    const course = document.getElementById('course').value.trim();
    const year = parseInt(document.getElementById('year').value);
    const cgpa = parseFloat(document.getElementById('cgpa').value);

    // Basic Validation
    if (students.some(s => s.roll === roll)) {
        alert('A student with this Roll Number already exists!');
        return;
    }

    const newStudent = { name, roll, course, year, cgpa };
    addStudent(newStudent);
    closeModal();
}

// CSV Import/Export Logic
function exportCSV() {
    if (students.length === 0) {
        alert("No data to export!");
        return;
    }

    let csvContent = "Name,RollNo,Course,Year,CGPA\n";
    students.forEach(s => {
        const row = [
            `"${s.name}"`, // Quote name to handle commas
            s.roll,
            `"${s.course}"`,
            s.year,
            s.cgpa
        ].join(",");
        csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "students.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        processCSV(text);
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = '';
}

function processCSV(csvText) {
    try {
        const lines = csvText.trim().split('\n');
        let newCount = 0;

        // Skip header if it looks like one
        const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Use simple comma split first (safest for the C app output)
            let values = line.split(',');

            // Heuristic checking for quotes (e.g. from Excel)
            if (line.includes('"')) {
                const robustMatches = line.match(/(?:^|,)(\s*"[^"]*"\s*|[^,]*)/g);
                if (robustMatches) {
                    values = robustMatches.map(v => {
                        let str = v.replace(/^,/, '').trim();
                        if (str.startsWith('"') && str.endsWith('"')) {
                            str = str.slice(1, -1).replace(/""/g, '"');
                        }
                        return str;
                    });
                }
            }

            let name, roll, course, year, cgpa;

            if (values.length >= 5) {
                name = values[0].trim();
                roll = parseInt(values[1]);
                course = values[2].trim();
                year = parseInt(values[3]);
                cgpa = parseFloat(values[4]);

                // Basic validity check
                if (name && !isNaN(roll) && course && !isNaN(year) && !isNaN(cgpa)) {
                    // Check duplicate
                    if (!students.some(s => s.roll === roll)) {
                        students.push({ name, roll, course, year, cgpa });
                        newCount++;
                    }
                }
            }
        }

        saveData();
        if (newCount > 0) {
            alert(`Successfully imported ${newCount} student(s).`);
        } else {
            alert("No new unique students imported.");
        }

    } catch (err) {
        console.error(err);
        alert('Error parsing CSV file. Please ensure it is formatted correctly.');
    }
}