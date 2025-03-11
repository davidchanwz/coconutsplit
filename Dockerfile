# Use an official Python runtime as a parent image
FROM python:3.10.12

# Set the working directory in the container
WORKDIR /app

# Copy all the files in the bot folder into the container
COPY ./bot .

# Copy the requirements file into the container
COPY requirements.txt .

COPY client.py .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r ./requirements.txt

EXPOSE 8443

# Run the bot when the container launches
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8443"]
